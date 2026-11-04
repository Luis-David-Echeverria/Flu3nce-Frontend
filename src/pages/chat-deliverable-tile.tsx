import type { Card } from "@/components/custom/consultation-deliverable-card";
import { deliverableLabel } from "@/services/v2/labels";

export function ChatDeliverableTile({ card, onOpen }: { card: Card; onOpen: () => void }) {
    const failed = card.status === "failed" || card.outcome === "failed";
    const awaitingInput = card.status === "needs_input";
    const preparing = !failed && !awaitingInput && (card.status === "generating" || !card.version);
    const title = card.title || deliverableLabel(card.deliverableType);
    return <button type="button" className="flu-message-part-deliverable" onClick={onOpen} disabled={!card.version || preparing} aria-busy={preparing}>
        <span aria-hidden="true" className="flu-message-part-deliverable-icon">▤</span>
        <span className="flu-message-part-deliverable-copy"><strong>{title}</strong><small>{failed ? "No generado" : awaitingInput ? "Necesita información" : preparing ? "Preparando entregable…" : `Versión ${card.version?.number}`}</small></span>
        {preparing ? <span aria-hidden="true" className="flu-activity-spinner" /> : <span aria-hidden="true" className="flu-message-part-deliverable-arrow">→</span>}
    </button>;
}
