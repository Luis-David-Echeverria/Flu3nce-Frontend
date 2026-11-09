import { describe, expect, it } from "vitest";
import { buildChatTimeline, type ChatMessage } from "./chat-timeline";

const message = (id: string, patch: Partial<ChatMessage>): ChatMessage => ({
    id, createdAt: `2026-10-17T10:00:0${id.length}Z`, role: "system", kind: "text", text: "", ...patch,
});

describe("historial visual de un trabajo", () => {
    it("presenta confirmación, cola, acuse y progreso como una sola tarjeta actualizable", () => {
        const messages = [
            message("user", { role: "user", text: "Prepara la política" }),
            message("intent", { role: "flu", kind: "intent_to_confirm", text: "Propuesta confirmada.", intent: { id: "i1", state: "confirmed", target: "deliverable", deliverableTypes: ["policy_draft"], jobId: "j1" } }),
            message("queued", { kind: "generation_status", text: "Recibí la petición", generationStatus: { jobId: "j1", target: "deliverable", phase: "queued", stepLabel: "En cola: borrador de política" } }),
            message("ack", { role: "flu", text: "Confirmado: preparo el borrador de política." }),
            message("running", { kind: "generation_status", text: "Estoy preparando", generationStatus: { jobId: "j1", target: "deliverable", phase: "running", stepLabel: "Preparando el borrador de política" } }),
        ];
        const timeline = buildChatTimeline(messages);
        expect(timeline).toHaveLength(2);
        expect(timeline[0]).toEqual({ type: "message", message: messages[0] });
        expect(timeline[1]).toMatchObject({ type: "job", jobId: "j1", messages: messages.slice(1) });
    });

    it("mantiene separados los mensajes útiles y los trabajos distintos", () => {
        const timeline = buildChatTimeline([
            message("j1", { kind: "generation_status", generationStatus: { jobId: "j1", target: "deliverable", phase: "running", stepLabel: "Preparando política" } }),
            message("reply", { role: "flu", text: "La aprobación corresponde a Finanzas." }),
            message("user", { role: "user", text: "También quiero una presentación" }),
            message("j2", { kind: "generation_status", generationStatus: { jobId: "j2", target: "deliverable", phase: "queued", stepLabel: "En cola: presentación" } }),
        ]);
        expect(timeline.map((item) => item.type === "job" ? item.jobId : item.message.id)).toEqual(["j1", "reply", "user", "j2"]);
    });

    it("no oculta una propuesta todavía pendiente ni un fallo sin job identificable", () => {
        const timeline = buildChatTimeline([
            message("pending", { kind: "intent_to_confirm", role: "flu", text: "¿La genero?", intent: { id: "i1", state: "pending", target: "deliverable", deliverableTypes: ["policy_draft"] } }),
            message("failure", { kind: "technical_failure", text: "Falló", failure: { code: "internal_error", message: "No se pudo terminar.", safeAction: "none" } }),
        ]);
        expect(timeline.map((item) => item.type)).toEqual(["message", "message"]);
    });

    it("pone la actividad antes de lo que produjo, sin absorber tarjetas ni reordenar los comentarios", () => {
        const card = (id: string): ChatMessage => message(id, { kind: "deliverable_card", refs: { jobId: "j1" }, deliverableCard: { deliverableId: id, deliverableType: "policy_draft", outcome: "generated", version: { id: `v-${id}`, number: 1 } } });
        const timeline = buildChatTimeline([
            message("queued", { kind: "generation_status", generationStatus: { jobId: "j1", target: "deliverable", phase: "queued", stepLabel: "Preparando" } }),
            card("politica"),
            message("explicacion", { role: "flu", text: "Con esa política preparo la presentación." }),
            card("presentacion"),
        ]);
        expect(timeline.map((entry) => entry.type === "job" ? "actividad" : entry.message.id)).toEqual(["actividad", "politica", "explicacion", "presentacion"]);
    });
});
