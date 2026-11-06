import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { clearStoredDrafts, useChatDraft } from "./use-chat-draft";

afterEach(() => window.localStorage.clear());

describe("borrador del compositor por chat", () => {
    it("guarda el borrador de cada chat y lo recupera al volver", () => {
        const hook = renderHook(({ scope }) => useChatDraft("u1", scope), { initialProps: { scope: "chat:a" } });
        act(() => hook.result.current.setDraft("Pregunta para A"));
        hook.rerender({ scope: "chat:b" });
        expect(hook.result.current.draft).toBe("");
        act(() => hook.result.current.setDraft("Pregunta para B"));
        hook.rerender({ scope: "chat:a" });
        expect(hook.result.current.draft).toBe("Pregunta para A");
        const reloaded = renderHook(() => useChatDraft("u1", "chat:b"));
        expect(reloaded.result.current.draft).toBe("Pregunta para B");
    });

    it("al enviar solo borra el texto enviado, no lo que se escribió después", () => {
        const hook = renderHook(() => useChatDraft("u1", "chat:a"));
        act(() => hook.result.current.setDraft("Primera"));
        act(() => hook.result.current.setDraft("Segunda, escrita mientras respondía"));
        act(() => hook.result.current.clearSent("chat:a", "Primera"));
        expect(hook.result.current.draft).toBe("Segunda, escrita mientras respondía");
        act(() => hook.result.current.clearSent("chat:a", "Segunda, escrita mientras respondía"));
        expect(hook.result.current.draft).toBe("");
        expect(window.localStorage.getItem("flu:draft:u1:chat:a")).toBeNull();
    });

    it("borra el enviado de otro chat aunque ya no sea el abierto", () => {
        const hook = renderHook(({ scope }) => useChatDraft("u1", scope), { initialProps: { scope: "chat:a" } });
        act(() => hook.result.current.setDraft("Enviado desde A"));
        hook.rerender({ scope: "chat:b" });
        act(() => hook.result.current.clearSent("chat:a", "Enviado desde A"));
        hook.rerender({ scope: "chat:a" });
        expect(hook.result.current.draft).toBe("");
    });

    it("al fallar un envío conserva lo escrito después y recupera el texto solo si está vacío", () => {
        const hook = renderHook(() => useChatDraft("u1", "chat:a"));
        act(() => hook.result.current.setDraft("Mi siguiente pregunta"));
        act(() => hook.result.current.restoreIfEmpty("chat:a", "Solicitud fallida"));
        expect(hook.result.current.draft).toBe("Mi siguiente pregunta");
        act(() => hook.result.current.setDraft(""));
        act(() => hook.result.current.restoreIfEmpty("chat:a", "Solicitud fallida"));
        expect(hook.result.current.draft).toBe("Solicitud fallida");
    });

    it("recupera un envío en su chat sin tocar el borrador del chat abierto", () => {
        const hook = renderHook(({ scope }) => useChatDraft("u1", scope), { initialProps: { scope: "chat:a" } });
        act(() => hook.result.current.setDraft("Borrador para A"));
        act(() => hook.result.current.restoreIfEmpty("chat:b", "Solicitud desde B"));
        expect(hook.result.current.draft).toBe("Borrador para A");
        hook.rerender({ scope: "chat:b" });
        expect(hook.result.current.draft).toBe("Solicitud desde B");
    });

    it("separa los borradores por cuenta y los borra al cerrar sesión", () => {
        const first = renderHook(() => useChatDraft("u1", "chat:a"));
        act(() => first.result.current.setDraft("De u1"));
        expect(renderHook(() => useChatDraft("u2", "chat:a")).result.current.draft).toBe("");
        clearStoredDrafts("u1");
        expect(renderHook(() => useChatDraft("u1", "chat:a")).result.current.draft).toBe("");
    });
});
