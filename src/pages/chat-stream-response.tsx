import { ChatMarkdown } from "@/components/custom/chat-markdown";
import type { Card } from "@/components/custom/consultation-deliverable-card";
import type { LiveActivity, LivePart, LiveTurn } from "./chat-stream-state";
import { ChatActivity, hasVisibleCompletedActivity } from "./chat-activity";
import { ChatReference } from "./chat-reference";
import { ChatDeliverableTile } from "./chat-deliverable-tile";

type Segment = { kind: "part"; part: LivePart } | { kind: "activity"; items: LiveActivity[] };

/** Texto, actividad y tarjetas en el orden en que llegaron; la actividad seguida va junta. */
export function liveSegments(turn: LiveTurn): Segment[] {
    const ordered = [
        ...turn.parts.map((part, position) => ({ order: part.order ?? position, segment: { kind: "part" as const, part } })),
        ...turn.activities.filter((item) => !item.jobId).map((item, position) => ({ order: item.order ?? Number.MAX_SAFE_INTEGER - turn.activities.length + position, activity: item })),
    ].sort((a, b) => a.order - b.order);
    const segments: Segment[] = [];
    for (const entry of ordered) {
        if ("segment" in entry) { segments.push(entry.segment); continue; }
        const last = segments[segments.length - 1];
        if (last?.kind === "activity") last.items.push(entry.activity);
        else segments.push({ kind: "activity", items: [entry.activity] });
    }
    return segments;
}

export function ChatStreamResponse({ turn, showReferences = false, onOpenDeliverable }: { turn: LiveTurn; showReferences?: boolean; onOpenDeliverable: (card: Card) => void }) {
    const finished = ["done", "failed", "cancelled"].includes(turn.state);
    // Cerrar el stream termina la respuesta, no los trabajos que lanzó: esos siguen en su actividad.
    const continuing = turn.state === "done" && !!turn.jobIds?.length;
    const segments = liveSegments(turn);
    const lastActivity = segments.reduce((index, segment, position) => segment.kind === "activity" ? position : index, -1);
    return <div className="flu-chat-stream" aria-label="Respuesta de Flu3nce en curso">
        {segments.map((segment, position) => {
            if (segment.kind === "part") {
                const part = segment.part;
                if (part.card) return <div className="flu-chat-stream-card" key={part.id}>{part.explanation ? <ChatMarkdown text={part.explanation} /> : null}<ChatDeliverableTile card={part.card} onOpen={() => onOpenDeliverable(part.card!)} /></div>;
                return part.blocks.length ? <article key={part.id} className="flu-message flu-assistant">{part.blocks.map((block) => <ChatMarkdown key={block.seq} text={block.text} />)}</article> : null;
            }
            const running = segment.items.some((item) => item.state === "running" || item.state === "pending");
            if (!running && !(turn.state === "running" && position === lastActivity) && !hasVisibleCompletedActivity(segment.items)) return null;
            const complete = finished || !running;
            return <ChatActivity key={`activity-${segment.items[0].id}`} items={segment.items} complete={complete}
                title={complete && continuing && position === lastActivity ? "Respuesta lista · el trabajo sigue en curso" : undefined}
                outcome={complete ? turn.state === "failed" && position === lastActivity ? "failed" : turn.state === "cancelled" ? "cancelled" : undefined : undefined}
                connection={turn.state === "interrupted" ? "reconnecting" : undefined} />;
        })}
        {!turn.phaseB && turn.legacyText ? <article className="flu-message flu-assistant"><ChatMarkdown text={turn.legacyText} /></article> : null}
        {turn.state === "running" && !turn.activities.some((item) => !item.jobId) ? <p className="flu-chat-live-status" role="status">{turn.cancelRequested ? "Deteniendo Flu3nce…" : "Pensando…"}</p> : null}
        {turn.state === "interrupted" ? <p role="status" className="flu-chat-live-status">Se interrumpió la conexión. Estamos consultando el estado de la respuesta; no se volverá a enviar la solicitud.</p> : null}
        {turn.state === "cancelled" ? <p role="status" className="flu-chat-live-status">Respuesta detenida.</p> : null}
        {turn.state === "failed" && turn.failure ? <p role="alert" className="flu-chat-failure">{turn.failure.message}</p> : null}
        {showReferences && turn.replyId ? <ChatReference chatId={turn.chatId} messageId={turn.replyId} requestId={turn.requestId} /> : null}
    </div>;
}
