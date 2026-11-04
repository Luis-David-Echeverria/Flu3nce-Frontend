import { describe, expect, it } from "vitest";
import type { ChainBlock } from "@/services/v2/types";
import { collectChainBlocks, mergeChainBlock } from "./chat-chain-state";
import { buildChatTimeline, type ChatMessage } from "./chat-timeline";
import type { LiveActivity } from "./chat-stream-state";

const block = (messageId: string, seq: number, kind: ChainBlock["kind"], extra: Partial<ChainBlock> = {}): ChainBlock => ({ requestId: "r1", blockId: `block:${messageId}`, seq, kind, final: false, messageId, ...extra });
const message = (id: string, chainBlock?: ChainBlock): ChatMessage => ({ id, role: "flu", kind: "text", text: id, createdAt: "2026-11-02T10:00:00Z", chainBlock });
const activity: LiveActivity = { id: "a1", requestId: "r1", seq: 2, jobId: "j1", label: "Preparando diagrama", kind: "generating_file", state: "running", ms: 10000, updatedAt: 10000 };

describe("cadena de mensajes y trabajos", () => {
    it("procesa message y chain.block con el mismo cursor una sola vez y no reescribe bloques publicados", () => {
        const first = block("plan", 1, "plan");
        const stored = collectChainBlocks([message("plan", first)], [first]);
        expect(stored).toEqual([first]);
        expect(mergeChainBlock(stored, { ...first, seq: 9 })).toBe(stored);
    });

    it("intercala la actividad en su lugar entre texto y entregables", () => {
        const messages = [message("plan", block("plan", 1, "plan")), message("card", block("card", 3, "deliverable", { jobId: "j1", deliverableId: "d1" })), message("transition", block("transition", 4, "transition"))];
        const timeline = buildChatTimeline(messages, { blocks: [], activities: [activity] });
        expect(timeline.map((entry) => entry.type === "message" ? entry.message.id : entry.type === "chain_activity" ? entry.activity.id : entry.jobId)).toEqual(["plan", "a1", "card", "transition"]);
    });

    it("recupera el mismo orden desde el historial aunque los resultados llegaran en otro orden", () => {
        const blocks = [block("plan", 1, "plan"), block("card", 3, "deliverable", { jobId: "j1" }), block("transition", 4, "transition"), block("final", 7, "explanation", { final: true, state: "completed" })];
        const history = [message("plan", blocks[0]), message("final", blocks[3]), message("transition", blocks[2]), message("card", blocks[1])];
        const restored = buildChatTimeline(history, { blocks: [], activities: [] });
        const live = buildChatTimeline(history.map((item) => ({ ...item, chainBlock: undefined })), { blocks, activities: [activity] });
        const ids = (entries: typeof restored) => entries.filter((entry) => entry.type === "message").map((entry) => entry.message.id);
        expect(ids(restored)).toEqual(["plan", "card", "transition", "final"]);
        expect(ids(live)).toEqual(ids(restored));
        expect(live.some((entry) => entry.type === "chain_activity")).toBe(false);
    });

    it("no duplica la actividad heredada de un job que pertenece a una cadena", () => {
        const plan = message("plan", block("plan", 1, "plan"));
        const progress: ChatMessage = { ...message("progress"), kind: "generation_status", generationStatus: { jobId: "j1", target: "deliverable", phase: "running", stepLabel: "Preparando" } };
        const timeline = buildChatTimeline([plan, progress], { blocks: [], activities: [activity] });
        expect(timeline.map((entry) => entry.type)).toEqual(["message", "chain_activity"]);
    });

    it("mantiene visibles los mensajes si recibe un tipo de bloque desconocido", () => {
        const future = { ...block("new", 1, "plan"), kind: "future_kind" };
        expect(mergeChainBlock([], future)).toEqual([]);
        const timeline = buildChatTimeline([message("new")], { blocks: [], activities: [] });
        expect(timeline).toEqual([{ type: "message", message: message("new") }]);
    });
});
