import type { ChainBlock, ConsultationMessage } from "@/services/v2/types";
import type { LiveActivity } from "./chat-stream-state";
import { collectChainBlocks } from "./chat-chain-state";

export type ChatMessage = ConsultationMessage & { unitId?: string };

type LegacyTimelineEntry =
    | { type: "message"; message: ChatMessage }
    | { type: "job"; jobId: string; messages: ChatMessage[] };
export type TimelineEntry = LegacyTimelineEntry | { type: "chain_activity"; activity: LiveActivity };

function eventJobId(message: ChatMessage): string | undefined {
    if (message.kind === "intent_to_confirm" && message.intent?.state === "confirmed") {
        return message.intent.jobId;
    }
    if (message.kind === "generation_status") return message.generationStatus?.jobId ?? message.refs?.jobId;
    if (message.kind === "deliverable_card" || message.kind === "technical_failure") return message.refs?.jobId;
    return undefined;
}

function isRoutineAcknowledgment(message: ChatMessage): boolean {
    return message.kind === "text" && message.role === "flu" &&
        /^Confirmado:\s*(preparo|prepararé|genero|generaré|rehago|voy a preparar|voy a generar|voy a rehacer)\b/i.test(message.text.trim());
}

/** Keep cards in chronological order; place each job's compact activity after its latest event. */
function legacyTimeline(messages: ChatMessage[]): LegacyTimelineEntry[] {
    const timeline: LegacyTimelineEntry[] = [];
    const jobs = new Map<string, Extract<LegacyTimelineEntry, { type: "job" }>>();
    let adjacentJob: Extract<LegacyTimelineEntry, { type: "job" }> | null = null;

    for (const message of messages) {
        if (message.chainBlock) { timeline.push({ type: "message", message }); adjacentJob = null; continue; }
        const jobId = eventJobId(message);
        if (jobId) {
            let entry = jobs.get(jobId);
            if (!entry) {
                entry = { type: "job", jobId, messages: [] };
                jobs.set(jobId, entry);
            }
            const previousIndex = timeline.indexOf(entry);
            if (previousIndex >= 0) timeline.splice(previousIndex, 1);
            entry.messages.push(message);
            // La actividad del trabajo va antes de lo que produjo, como ocurrió.
            const firstCard = timeline.findIndex((item) => item.type === "message" && item.message.kind === "deliverable_card" && eventJobId(item.message) === jobId);
            if (firstCard >= 0) timeline.splice(firstCard, 0, entry);
            else timeline.push(entry);
            if (message.kind === "deliverable_card") timeline.push({ type: "message", message });
            adjacentJob = entry;
            continue;
        }

        // El backend todavía emite este acuse como texto sin jobId. Solo se pliega
        // cuando sigue inmediatamente a un evento inequívoco del mismo trabajo.
        if (adjacentJob && isRoutineAcknowledgment(message)) {
            adjacentJob.messages.push(message);
            continue;
        }

        timeline.push({ type: "message", message });
        adjacentJob = null;
    }

    return timeline;
}

type ChainOptions = { blocks: ChainBlock[]; activities: LiveActivity[] };
export function buildChatTimeline(messages: ChatMessage[]): LegacyTimelineEntry[];
export function buildChatTimeline(messages: ChatMessage[], options: ChainOptions): TimelineEntry[];
export function buildChatTimeline(messages: ChatMessage[], options?: ChainOptions): TimelineEntry[] {
    if (!options) return legacyTimeline(messages);
    const blocks = collectChainBlocks(messages, options.blocks);
    const byMessage = new Map(blocks.map((block) => [block.messageId, block]));
    const byId = new Map(messages.map((message) => [message.id, message]));
    const chainJobs = new Set([...blocks.flatMap((block) => block.jobId ? [block.jobId] : []), ...options.activities.flatMap((activity) => activity.requestId && activity.jobId ? [activity.jobId] : [])]);
    const requests = new Set([...blocks.map((block) => block.requestId), ...options.activities.flatMap((activity) => activity.requestId ? [activity.requestId] : [])]);
    const groups = new Map<string, TimelineEntry[]>();
    for (const requestId of requests) {
        const requestBlocks = blocks.filter((block) => block.requestId === requestId);
        const finished = requestBlocks.some((block) => block.final);
        const ordered: { seq: number; entry: TimelineEntry }[] = requestBlocks.flatMap((block) => {
            const message = byId.get(block.messageId);
            return message ? [{ seq: block.seq, entry: { type: "message" as const, message: { ...message, chainBlock: block } } }] : [];
        });
        if (!finished) for (const activity of options.activities) if (activity.requestId === requestId && activity.seq !== undefined) ordered.push({ seq: activity.seq, entry: { type: "chain_activity", activity } });
        groups.set(requestId, ordered.sort((left, right) => left.seq - right.seq).map((item) => item.entry));
    }
    const emitted = new Set<string>(), result: TimelineEntry[] = [];
    const emit = (requestId: string) => { if (!emitted.has(requestId)) { emitted.add(requestId); result.push(...(groups.get(requestId) ?? [])); } };
    const filtered = messages.filter((message) => {
        const jobId = eventJobId(message);
        return byMessage.has(message.id) || !jobId || !chainJobs.has(jobId);
    }).map((message) => byMessage.has(message.id) ? { ...message, chainBlock: byMessage.get(message.id) } : message);
    for (const entry of legacyTimeline(filtered)) {
        if (entry.type === "message") {
            const block = byMessage.get(entry.message.id);
            if (block) { emit(block.requestId); continue; }
            result.push(entry);
            for (const activity of options.activities) if (activity.requestId && activity.replyId === entry.message.id) emit(activity.requestId);
        } else if (!chainJobs.has(entry.jobId)) result.push(entry);
    }
    for (const requestId of requests) emit(requestId);
    return result;
}
