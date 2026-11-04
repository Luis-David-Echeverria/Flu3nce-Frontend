import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const watch = vi.hoisted(() => vi.fn());
vi.mock("@/services/v2/chats", () => ({ watchChatEvents: watch }));
import { useChatEvents } from "./use-chat-events";

afterEach(() => { cleanup(); watch.mockReset(); vi.useRealTimers(); });

describe("conexión reanudable de actividad", () => {
    it("conserva la cadena aunque message y chain.block compartan cursor y restaura una actividad desde un latido", async () => {
        watch.mockImplementation(() => new Promise(() => undefined));
        const receive = vi.fn();
        const hook = renderHook(() => useChatEvents("c1", "m1", true, receive));
        const block = { requestId: "r1", blockId: "b1", seq: 1, kind: "plan", final: false, messageId: "m2" };
        await act(async () => {
            watch.mock.calls[0][2]({ event: "message", id: "m2", data: { id: "m2", text: "Voy a preparar ambos", chainBlock: block } });
            watch.mock.calls[0][2]({ event: "chain.block", id: "m2", data: block });
            watch.mock.calls[0][2]({ event: "activity.heartbeat", data: { activityId: "a1", jobId: "j1", requestId: "r1", seq: 2, kind: "model_call", label: "Estructurando", ms: 80000 } });
        });
        expect(receive).toHaveBeenCalledOnce();
        expect(hook.result.current.chainBlocks).toEqual([block]);
        expect(hook.result.current.activities[0]).toMatchObject({ id: "a1", label: "Estructurando", ms: 80000 });
    });
    it("reconecta desde el último ID recibido y cierra la conexión al salir del chat", async () => {
        vi.useFakeTimers();
        watch.mockResolvedValueOnce(true).mockImplementation(() => new Promise(() => undefined));
        const receive = vi.fn();
        const hook = renderHook(({ id, after }) => useChatEvents(id, after, true, receive), { initialProps: { id: "chat1", after: "msg1" } });
        await act(async () => {
            watch.mock.calls[0][2]({ event: "message", id: "msg2", data: { id: "msg2", text: "Listo" } });
            watch.mock.calls[0][2]({ event: "activity.start", data: { activityId: "a1", jobId: "j1", label: "Preparando PDF" } });
            await Promise.resolve();
        });
        expect(receive).toHaveBeenCalledWith({ id: "msg2", text: "Listo" });
        expect(hook.result.current.activities[0].label).toBe("Preparando PDF");
        hook.rerender({ id: "chat1", after: "msg2" });
        expect(watch).toHaveBeenCalledTimes(1);
        await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
        expect(watch.mock.calls[1][1]).toBe("msg2");
        hook.rerender({ id: "chat2", after: "other" });
        expect(watch.mock.calls[1][3].aborted).toBe(true);
        expect(watch.mock.calls[2][0]).toBe("chat2");
        expect(hook.result.current.activities).toEqual([]);
        hook.unmount();
        expect(watch.mock.calls[2][3].aborted).toBe(true);
    });
});
