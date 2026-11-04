import { describe, expect, it } from "vitest";
import { beginLiveTurn, reduceActivity, reduceLiveTurn } from "./chat-stream-state";
import type { ChatStreamEvent } from "@/services/v2/chats";

const frame = (event: string, data: Record<string, unknown>): ChatStreamEvent => ({ event, data });

describe("respuesta en partes del turno", () => {
    it("actualiza la misma actividad varias veces aunque seq sea el del bloque fijo", () => {
        const initial = beginLiveTurn("c1", "request1", "Diagrámalo");
        const started = reduceLiveTurn(initial, frame("activity.start", { activityId: "a1", requestId: "r1", seq: 2, jobId: "j1", stage: "reading", kind: "reading_sources", label: "Leyendo", ms: 0 }), 1000);
        const updated = reduceLiveTurn(started, frame("activity.update", { activityId: "a1", requestId: "r1", seq: 2, jobId: "j1", stage: "structure", kind: "model_call", label: "Bloque 1 de 3", ms: 4000 }), 5000);
        const progressed = reduceLiveTurn(updated, frame("activity.update", { activityId: "a1", requestId: "r1", seq: 2, jobId: "j1", stage: "structure", kind: "model_call", label: "Bloque 2 de 3", ms: 8000 }), 9000);
        expect(progressed.activities).toHaveLength(1);
        expect(progressed.activities[0]).toMatchObject({ label: "Bloque 2 de 3", ms: 8000, stages: [{ stage: "reading", label: "Leyendo", ms: 4000 }] });
    });

    it("reconstruye la actividad desde un latido completo sin haber recibido start", () => {
        const restored = reduceActivity([], frame("activity.heartbeat", { activityId: "a1", requestId: "r1", seq: 2, jobId: "j1", kind: "model_call", stage: "structure", label: "Bloque 3 de 5", ms: 120000 }), 500000);
        expect(restored).toHaveLength(1);
        expect(restored[0]).toMatchObject({ requestId: "r1", seq: 2, label: "Bloque 3 de 5", state: "running", ms: 120000, updatedAt: 500000 });
        const ended = reduceActivity(restored, frame("activity.end", { activityId: "a1", jobId: "j1", state: "done", ms: 130000, folded: true }), 510000);
        expect(reduceActivity(ended, frame("activity.start", { activityId: "a1", jobId: "j1", label: "Viejo" }))).toBe(ended);
    });

    it("conserva la correlación y los jobs al cerrar una respuesta que solo los lanzó", () => {
        const accepted = reduceLiveTurn(beginLiveTurn("c1", "request1", "Prepara ambos"), frame("message", { userMessage: { id: "u1" }, reply: { id: "m1" }, outcome: "launched", nucleo: { requestId: "r1" } }));
        const done = reduceLiveTurn(accepted, frame("done", { replyId: "m1", outcome: "launched", jobIds: ["j1", "j2", "j1"] }));
        expect(done).toMatchObject({ state: "done", requestId: "r1", outcome: "launched", jobIds: ["j1", "j2"] });
    });

    it("distingue un fallo del servidor de una desconexión", () => {
        const failed = reduceLiveTurn(beginLiveTurn("c1", "request1", "Genera"), frame("error", { code: "output_invalid", message: "No se pudo construir el documento." }));
        expect(failed).toMatchObject({ state: "failed", failure: { code: "output_invalid", message: "No se pudo construir el documento." } });
    });
    it("conserva texto, entregables y texto en el orden del contrato sin duplicar el protocolo anterior", () => {
        const events = [
            frame("turn.start", { turnId: "t1", seq: 1 }),
            frame("text", { delta: "Respuesta completa del protocolo anterior" }),
            frame("part.start", { partId: "p1", index: 0, kind: "text", seq: 2 }),
            frame("text.block", { partId: "p1", markdown: "## Hallazgos", seq: 3 }),
            frame("text.block", { partId: "p1", markdown: "La aprobación requiere seguimiento.", seq: 4 }),
            frame("part.start", { partId: "p2", index: 1, kind: "deliverable_card", seq: 5 }),
            frame("deliverable.card", { partId: "p2", deliverableCard: { deliverableId: "d1", version: { id: "v1", number: 1 } }, seq: 6 }),
            frame("part.start", { partId: "p3", index: 2, kind: "text", seq: 7 }),
            frame("text.block", { partId: "p3", markdown: "La política ya refleja ese cambio.", seq: 8 }),
        ];
        const turn = events.reduce((state, event) => reduceLiveTurn(state, event), beginLiveTurn("c1", "request1", "Revisa"));
        expect(turn.phaseB).toBe(true);
        expect(turn.parts.map((part) => part.kind)).toEqual(["text", "deliverable_card", "text"]);
        expect(turn.parts[0].blocks.map((block) => block.text)).toEqual(["## Hallazgos", "La aprobación requiere seguimiento."]);
        expect(turn.parts[1].card?.version?.id).toBe("v1");
        expect(reduceLiveTurn(turn, events[3])).toBe(turn);
    });

    it("no añade contenido tardío mientras se solicita detener ni después de la cancelación", () => {
        const initial = { ...beginLiveTurn("c1", "request1", "Revisa"), cancelRequested: true };
        expect(reduceLiveTurn(initial, frame("text.block", { partId: "p1", markdown: "Tardío", seq: 4 }))).toBe(initial);
        const stopped = reduceLiveTurn(initial, frame("cancelled", { turnId: "t1", seq: 5 }));
        expect(stopped.state).toBe("cancelled");
        expect(reduceLiveTurn(stopped, frame("part.start", { partId: "p2", index: 1, seq: 6 }))).toBe(stopped);
    });

    it("cerrar la respuesta no termina los trabajos derivados que siguen en segundo plano", () => {
        const turn = [
            frame("activity.start", { activityId: "answer", kind: "model_call", label: "Redactando respuesta" }),
            frame("activity.start", { activityId: "file", jobId: "j1", kind: "generating_file", label: "Generando diagrama" }),
        ].reduce((state, event) => reduceLiveTurn(state, event, 1000), beginLiveTurn("c1", "request1", "Diagrámalo"));
        const ended = reduceLiveTurn(turn, frame("done", { replyId: "m1" }), 5000);
        expect(ended.state).toBe("done");
        expect(ended.activities.find((item) => item.id === "answer")?.state).toBe("done");
        expect(ended.activities.find((item) => item.jobId === "j1")?.state).toBe("running");
    });

    it("al cancelar solo cierra los trabajos que el servidor confirma como detenidos", () => {
        const turn = ["j1", "j2"].reduce((state, jobId) => reduceLiveTurn(state, frame("activity.start", { activityId: "file", jobId, kind: "generating_file", label: "Generando archivo" }), 1000), beginLiveTurn("c1", "request1", "Genera ambos"));
        const stopped = reduceLiveTurn(turn, frame("cancelled", { stoppedJobs: ["j1"] }), 5000);
        expect(stopped.activities.find((item) => item.jobId === "j1")?.state).toBe("cancelled");
        expect(stopped.activities.find((item) => item.jobId === "j2")?.state).toBe("running");
    });

    it("actualiza señal de vida y progreso con la información real del trabajo", () => {
        const started = reduceActivity([], frame("activity.start", { activityId: "a1", jobId: "j1", kind: "ocr", label: "Leyendo PDF" }), 1000);
        const heartbeat = reduceActivity(started, frame("activity.heartbeat", { activityId: "a1", jobId: "j1", ms: 10000, progress: { done: 3, total: 64, unit: "page" } }), 11000);
        expect(heartbeat[0]).toMatchObject({ state: "running", ms: 10000, updatedAt: 11000, progress: { done: 3, total: 64, unit: "page" } });
        const ended = reduceActivity(heartbeat, frame("activity.end", { activityId: "a1", jobId: "j1", state: "done", ms: 15000 }), 16000);
        expect(ended[0].state).toBe("done");
        expect(reduceActivity(ended, frame("activity.start", { activityId: "a1", jobId: "j1" }))).toBe(ended);
    });
});
