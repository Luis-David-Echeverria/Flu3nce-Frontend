import { ChatMarkdown } from "@/components/custom/chat-markdown";
import type { Card } from "@/components/custom/consultation-deliverable-card";
import type { LiveTurn } from "./chat-stream-state";
import { ChatActivity, hasVisibleCompletedActivity } from "./chat-activity";
import { ChatReference } from "./chat-reference";
import { ChatDeliverableTile } from "./chat-deliverable-tile";

export function ChatStreamResponse({ turn, showReferences = false, onOpenDeliverable }: { turn: LiveTurn; showReferences?: boolean; onOpenDeliverable: (card: Card) => void }) {
    return <div className="flu-chat-stream" aria-label="Respuesta de Flu3nce en curso">
        {turn.parts.map((part) => part.card ? <div className="flu-chat-stream-card" key={part.id}>{part.explanation ? <ChatMarkdown text={part.explanation} /> : null}<ChatDeliverableTile card={part.card} onOpen={() => onOpenDeliverable(part.card!)} /></div> : part.blocks.length ? <article key={part.id} className="flu-message flu-assistant">{part.blocks.map((block) => <ChatMarkdown key={block.seq} text={block.text} />)}</article> : null)}
        {!turn.phaseB && turn.legacyText ? <article className="flu-message flu-assistant"><ChatMarkdown text={turn.legacyText} /></article> : null}
        {(turn.state === "running" || hasVisibleCompletedActivity(turn.activities.filter((item) => !item.jobId))) ? <ChatActivity items={turn.activities.filter((item) => !item.jobId)} complete={["done", "failed", "cancelled"].includes(turn.state)} outcome={turn.state === "failed" ? "failed" : turn.state === "cancelled" ? "cancelled" : undefined} connection={turn.state === "interrupted" ? "reconnecting" : undefined} /> : null}
        {turn.state === "running" && !turn.activities.length ? <p className="flu-chat-live-status" role="status">{turn.cancelRequested ? "Deteniendo Flu3nce…" : "Pensando…"}</p> : null}
        {turn.state === "interrupted" ? <p role="status" className="flu-chat-live-status">Se interrumpió la conexión. Estamos consultando el estado de la respuesta; no se volverá a enviar la solicitud.</p> : null}
        {turn.state === "cancelled" ? <p role="status" className="flu-chat-live-status">Respuesta detenida.</p> : null}
        {turn.state === "failed" && turn.failure ? <p role="alert" className="flu-chat-failure">{turn.failure.message}</p> : null}
        {showReferences && turn.replyId ? <ChatReference chatId={turn.chatId} messageId={turn.replyId} requestId={turn.requestId} /> : null}
    </div>;
}
