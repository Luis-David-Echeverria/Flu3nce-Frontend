import type { components } from "@/lib/api-schema";
import type { ChatStreamEvent } from "@/services/v2/chats";
import type { Card } from "@/components/custom/consultation-deliverable-card";
import type { ChainActivityStage, PermissionPending } from "@/services/v2/types";

export type ActivityGroup = components["schemas"]["ActivityGroup"];
export type LiveActivity = { id: string; label: string; kind: string; state: string; ms: number; updatedAt: number; jobId?: string; requestId?: string; seq?: number; stage?: string; title?: string; replyId?: string; intentId?: string; chatId?: string; waitingFor?: components["schemas"]["JobWaitingFor"]; stages?: ChainActivityStage[]; folded?: boolean; expectHeartbeat?: boolean; durationUnknown?: boolean; progress?: { done: number; total: number; unit: string }; order?: number };
/** `order`: orden de llegada en el turno, para intercalar texto, actividad y tarjetas como ocurrieron. */
export type LivePart = { id: string; index: number; kind: string; blocks: { seq: number; text: string }[]; card?: Card; explanation?: string; order?: number };
export type LiveTurn = { chatId: string; clientMessageId: string; prompt: string; accepted: boolean; phaseB: boolean; turnId?: string; userMessageId?: string; replyId?: string; requestId?: string; jobIds?: string[]; outcome?: components["schemas"]["ConsultationExchange"]["outcome"]; failure?: components["schemas"]["TurnFailure"]; permissionsPending?: PermissionPending[]; state: "running" | "done" | "failed" | "cancelled" | "interrupted"; parts: LivePart[]; activities: LiveActivity[]; legacyText: string; seen: string[]; startedAt: number; cancelRequested?: boolean; nextOrder?: number };
export const beginLiveTurn = (chatId: string, clientMessageId: string, prompt: string): LiveTurn => ({ chatId, clientMessageId, prompt, accepted: false, phaseB: false, state: "running", parts: [], activities: [], legacyText: "", seen: [], startedAt: Date.now() });

export function reduceActivity(items: LiveActivity[], event: ChatStreamEvent, now = Date.now()): LiveActivity[] {
    const data = event.data;
    if (typeof data.activityId !== "string") return items;
    if (!["activity.start", "activity.update", "activity.heartbeat", "activity.end"].includes(event.event)) return items;
    const matches = (item: LiveActivity) => item.id === data.activityId && item.jobId === data.jobId;
    const found = items.find(matches);
    if (found && ["done", "failed", "cancelled", "skipped"].includes(found.state) && event.event !== "activity.end") return items;
    if (found && typeof data.ms === "number" && data.ms < found.ms) return items;
    if (!found && event.event !== "activity.start" && typeof data.label !== "string") return items;
    const fields: Partial<LiveActivity> = {};
    for (const key of ["requestId", "stage", "title", "replyId", "intentId", "chatId", "label", "kind"] as const) if (typeof data[key] === "string") fields[key] = data[key];
    if (typeof data.seq === "number") fields.seq = data.seq;
    if (typeof data.kind === "string") fields.expectHeartbeat = data.kind !== "queued";
    if (Array.isArray(data.stages)) fields.stages = data.stages as ChainActivityStage[];
    if (typeof data.folded === "boolean") fields.folded = data.folded;
    if (data.progress && typeof data.progress === "object") fields.progress = data.progress as LiveActivity["progress"];
    if (data.waitingFor && typeof data.waitingFor === "object") fields.waitingFor = data.waitingFor as LiveActivity["waitingFor"];
    else if (event.event === "activity.update") fields.waitingFor = undefined;
    const stageChanged = found?.stage && typeof data.stage === "string" && found.stage !== data.stage;
    if (stageChanged && !fields.stages) fields.stages = [...(found.stages ?? []), { stage: found.stage!, kind: found.kind as ChainActivityStage["kind"], label: found.label, ms: Math.max(0, (typeof data.ms === "number" ? data.ms : found.ms) - (found.stages ?? []).reduce((sum, step) => sum + (step.ms ?? 0), 0)) }];
    const next: LiveActivity = { id: data.activityId, jobId: typeof data.jobId === "string" ? data.jobId : undefined, label: "Preparando la respuesta", kind: "tool", ms: 0, ...found, ...fields, state: event.event === "activity.end" ? String(data.state ?? "done") : found?.state ?? "running", updatedAt: now };
    if (typeof data.ms === "number") next.ms = data.ms;
    if (event.event === "activity.start" && found && data.ms === undefined) return items;
    return found ? items.map((item) => matches(item) ? next : item) : [...items, next];
}

/** Prefer phase-B blocks over legacy text, deduplicate replayed events, preserve part order. */
export function reduceLiveTurn(current: LiveTurn, event: ChatStreamEvent, now = Date.now()): LiveTurn {
    if (["cancelled", "done", "failed"].includes(current.state)) return current;
    if (current.cancelRequested && ["text", "text.block", "deliverable.card", "part.start", "part.end"].includes(event.event)) return current;
    if (event.event.startsWith("activity.")) {
        let order = current.nextOrder ?? 0;
        const activities = reduceActivity(current.activities, event, now).map((item) => item.order !== undefined ? item : { ...item, order: order++ });
        return { ...current, activities, nextOrder: order };
    }
    const data = event.data, key = typeof data.seq === "number" ? `${event.event}:${data.seq}` : undefined;
    if (key && current.seen.includes(key)) return current;
    const next = { ...current, seen: key ? [...current.seen, key] : current.seen };
    if (event.event === "received") return { ...next, accepted: true };
    if (event.event === "turn.start") return { ...next, accepted: true, phaseB: true, turnId: String(data.turnId) };
    if (event.event === "error") return { ...next, state: "failed", outcome: "failed", failure: { code: String(data.code ?? "internal_error"), message: String(data.message ?? "No se pudo completar la respuesta.") } };
    if (event.event === "text") return { ...next, legacyText: next.legacyText + (typeof data.delta === "string" ? data.delta : "") };
    if (event.event === "part.start" && typeof data.partId === "string") {
        if (next.parts.some((part) => part.id === data.partId)) return next;
        const order = next.nextOrder ?? 0;
        return { ...next, phaseB: true, nextOrder: order + 1, parts: [...next.parts, { id: data.partId, index: Number(data.index ?? next.parts.length), kind: String(data.kind ?? "text"), blocks: [], order }].sort((a, b) => a.index - b.index) };
    }
    if ((event.event === "text.block" || event.event === "deliverable.card") && typeof data.partId === "string") {
        const known = next.parts.some((part) => part.id === data.partId);
        const order = next.nextOrder ?? 0;
        const parts = known ? next.parts : [...next.parts, { id: data.partId, index: next.parts.length, kind: event.event === "text.block" ? "text" : "deliverable_card", blocks: [], order }];
        return { ...next, phaseB: true, nextOrder: known ? order : order + 1, parts: parts.map((part) => part.id !== data.partId ? part : event.event === "text.block" ? { ...part, blocks: [...part.blocks, { seq: Number(data.seq ?? part.blocks.length), text: String(data.markdown ?? "") }].sort((a, b) => a.seq - b.seq) } : { ...part, card: data.deliverableCard as Card, explanation: typeof data.explanation === "string" ? data.explanation : undefined }) };
    }
    if (event.event === "message") {
        const exchange = data as unknown as components["schemas"]["ConsultationExchange"];
        return { ...next, replyId: exchange.reply?.id, userMessageId: exchange.userMessage?.id, requestId: exchange.nucleo?.requestId, outcome: exchange.outcome, failure: exchange.failure, permissionsPending: exchange.permissionsPending, jobIds: exchange.reply?.refs?.jobId ? [exchange.reply.refs.jobId] : [] };
    }
    if (event.event === "done" || event.event === "cancelled") {
        const cancelled = event.event === "cancelled";
        const stoppedJobs = Array.isArray(data.stoppedJobs) ? data.stoppedJobs : [];
        // A turn's done closes its response, not the background jobs it launched.
        // Their activity continues through events-stream until a real job result.
        return { ...next, jobIds: [...new Set([...(next.jobIds ?? []), ...(Array.isArray(data.jobIds) ? data.jobIds.filter((id): id is string => typeof id === "string") : [])])], outcome: typeof data.outcome === "string" ? data.outcome as LiveTurn["outcome"] : next.outcome, failure: data.failure ? data.failure as LiveTurn["failure"] : next.failure, permissionsPending: Array.isArray(data.permissionsPending) ? data.permissionsPending as PermissionPending[] : next.permissionsPending, replyId: typeof data.replyId === "string" ? data.replyId : next.replyId, state: cancelled ? "cancelled" : data.outcome === "failed" || next.outcome === "failed" ? "failed" : "done", activities: next.activities.map((item) =>
            ["running", "pending"].includes(item.state) && (!item.jobId || (cancelled && stoppedJobs.includes(item.jobId)))
                ? { ...item, state: cancelled ? "cancelled" : "done", ms: item.ms + Math.max(0, now - item.updatedAt), updatedAt: now }
                : item) };
    }
    return next;
}
