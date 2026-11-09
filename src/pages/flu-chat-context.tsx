import type { CSSProperties, ReactNode } from "react";
import { ChevronRight } from "@untitledui/icons";
import type { Card } from "@/components/custom/consultation-deliverable-card";
import { deliverableLabel } from "@/services/v2/labels";
import type { Source } from "@/services/v2/types";
import { FluResizeHandle } from "./flu-resize-handle";
import { SourceTypeIcon } from "./flu-source-preview";
import { DeliverableTypeIcon } from "./flu-chats-icons";
import { cardTitle, type ChatMessage } from "./flu-chats-helpers";

type Props = {
    visible: boolean;
    width: number;
    maxWidth: number;
    onWidthChange: (width: number) => void;
    title: string;
    onCollapse: () => void;
    sources: Source[];
    orderedSources: Source[];
    hasMoreSources: boolean;
    sourcesError: string | null;
    onOpenSource: (source: Source) => void;
    onLoadMoreSources: () => void;
    /** Herramientas de fuentes del chat (biblioteca del proyecto), si aplican. */
    sourceTools?: ReactNode;
    deliverables: ChatMessage[];
    onOpenDeliverable: (card: Card, unitId: string) => void;
    busy: boolean;
    /** Acciones del chat al pie del panel (mover, compartir, miembros). */
    actions?: ReactNode;
};

/** Panel derecho: fuentes y entregables del chat. */
export function FluChatContext({ visible, width, maxWidth, onWidthChange, title, onCollapse, sources, orderedSources, hasMoreSources, sourcesError, onOpenSource, onLoadMoreSources, sourceTools, deliverables, onOpenDeliverable, busy, actions }: Props) {
    return <aside id="flu-context" aria-label="Contexto del chat" aria-hidden={!visible} inert={!visible} className="flu-context shrink-0 p-5" style={{ "--flu-context-width": `${width}px` } as CSSProperties}>
        {visible ? <FluResizeHandle label="Ajustar ancho del contexto" value={width} min={Math.min(280, maxWidth)} max={maxWidth} direction={-1} onChange={onWidthChange} /> : null}
        <div className="flu-context-scroll"><div className="flu-context-heading"><div><p className="flu-label">CONTEXTO DEL CHAT</p><h2>{title}</h2></div><button type="button" aria-label="Plegar contexto" onClick={onCollapse}><ChevronRight aria-hidden="true" /></button></div>
        <section className="flu-context-section"><div className="flex items-center justify-between"><h3>Fuentes</h3><span>{sources.length}{hasMoreSources ? "+" : ""}</span></div>{sourcesError ? <p role="alert" className="mt-2 text-xs text-[color:var(--fl-error-text)]">{sourcesError}</p> : null}{sources.length ? orderedSources.map((source) => <button key={source.id} type="button" onClick={() => onOpenSource(source)} className="flu-context-item flu-context-source" title={`Ver archivo original ${source.name}`}><SourceTypeIcon source={source} /><span className="min-w-0"><span className="block truncate">{source.name}</span>{source.status === "processing" ? <span className="block text-[10px] text-[color:var(--fl-warning-text)]">Procesando contenido…</span> : source.status === "failed" ? <span className="block text-[10px] text-[color:var(--fl-error-text)]">No se pudo procesar el contenido</span> : null}</span></button>) : <p className="flu-context-empty">Todavía no hay fuentes añadidas.</p>}{hasMoreSources ? <button type="button" disabled={busy} onClick={onLoadMoreSources} className="flu-context-action">Ver más fuentes</button> : null}</section>
        {sourceTools}
        <section className="flu-context-section"><div className="flex items-center justify-between"><h3>Entregables</h3><span>{deliverables.length}</span></div>{deliverables.length ? deliverables.map((item) => item.unitId ? <button key={item.id} type="button" onClick={() => onOpenDeliverable(item.deliverableCard!, item.unitId!)} className="flu-context-item flu-context-deliverable" aria-label={`Ver ${deliverableLabel(item.deliverableCard!.deliverableType)}, versión ${item.deliverableCard!.version?.number ?? "en curso"}`}><span className="flu-context-deliverable-icon"><DeliverableTypeIcon type={item.deliverableCard!.deliverableType} /></span><span className="flu-context-deliverable-title">{cardTitle(item.deliverableCard!)} · versión {item.deliverableCard!.version?.number ?? "en curso"}</span><span aria-hidden="true">→</span></button> : null) : <p className="flu-context-empty">Todavía no hay entregables. Puedes pedir el primero en el chat.</p>}</section>
        <p className="flu-source-help flu-context-scope">Las fuentes y los entregables son de este chat; la biblioteca es del proyecto y solo entra lo que adjuntes. Flu3nce puede buscar en otros chats de este mismo proyecto, nunca de otros. Tu memoria personal te acompaña en todos tus chats y está en el menú de tu cuenta.</p>
        {actions}
        </div>
    </aside>;
}
