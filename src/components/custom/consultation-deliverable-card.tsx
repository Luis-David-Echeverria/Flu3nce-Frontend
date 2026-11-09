import { lazy, Suspense, useEffect, useId, useState } from "react";
import { Link, useLocation } from "react-router";
import { ChevronRight, File02, GitBranch01, PresentationChart01 } from "@untitledui/icons";
import { downloadDeliverable, downloadDeliverableVersion, getDeliverable, getDeliverableJson, getDeliverablePreview, getDeliverableVersionJson, listDeliverableVersions, type DownloadFormat } from "@/services/v2/deliverables";
import { ApiServiceError } from "@/services/v2/http";
import { deliverableLabel } from "@/services/v2/labels";
import type { ConsultationMessage, ContractA, DeliverableJsonContent, DeliverablePreview, DiagnosticContent, DocumentContent, PolicyAnalysisContent, PolicyDraftContent, TranscriptionContent, UnderstandingContent, VersionList } from "@/services/v2/types";
import { ChatMarkdown } from "./chat-markdown";
import { InlinePresentationPreview } from "./consultation-presentation-preview";
import { FluPdfDocument } from "@/pages/flu-pdf-document";
import { FluDocxViewer } from "@/pages/flu-source-preview";

const DeliverableContentView = lazy(() => import("./deliverable-content-view").then((module) => ({ default: module.DeliverableContentView })));
const FluDiagramPreview = lazy(() => import("./flu-diagram-preview").then((module) => ({ default: module.FluDiagramPreview })));

export type Card = NonNullable<ConsultationMessage["deliverableCard"]>;
type Preview =
    | { state: "idle" | "loading" }
    | { state: "content"; content: DeliverableJsonContent }
    | { state: "structured"; preview: DeliverablePreview }
    | { state: "presentation"; pdf: Blob; formats?: DeliverablePreview["formats"] }
    | { state: "document"; docx: Blob; formats: DeliverablePreview["formats"] }
    | { state: "historical"; currentVersion: number }
    | { state: "unavailable"; reason: string };

function CardIcon({ type }: { type: Card["deliverableType"] }) {
    if (type === "presentation") return <PresentationChart01 className="size-5" aria-hidden="true" />;
    if (type === "diagram_as_is" || type === "understanding") return <GitBranch01 className="size-5" aria-hidden="true" />;
    return <File02 className="size-5" aria-hidden="true" />;
}

function PreviewLine({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--fl-text-4)]">{label}</p><p className="mt-1 line-clamp-3 text-xs leading-5 text-[color:var(--fl-text-2)]">{children}</p></div>;
}

function StructuredPreview({ content }: { content: NonNullable<DeliverablePreview["content"]> }) {
    // Producción ya publica understanding-v2, mientras algunos pines antiguos aún
    // tipan el discriminante como v1. El valor se comprueba en ejecución.
    switch (String(content.schemaVersion)) {
        case "document-v1": return <ChatMarkdown text={(content as DocumentContent).markdown} />;
        case "diagnostic-v1": {
            const result = content as DiagnosticContent;
            return <div className="space-y-4"><PreviewLine label="Resumen ejecutivo">{result.resumenEjecutivo || "Sin resumen ejecutivo registrado."}</PreviewLine><div className="grid gap-2 sm:grid-cols-2">{result.dimensions.slice(0, 4).map((dimension) => <div key={dimension.id} className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2.5"><p className="text-xs font-semibold text-[color:var(--fl-text)]">{dimension.name}</p><p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--fl-text-4)]">{dimension.soWhat || dimension.rationale || "Sin explicación registrada."}</p></div>)}</div>{result.dimensions.length > 4 ? <p className="text-[11px] text-[color:var(--fl-text-4)]">Y {result.dimensions.length - 4} dimensiones más en el detalle.</p> : null}</div>;
        }
        case "understanding-v1":
        case "understanding-v2": {
            const result = content as UnderstandingContent & { flujo?: unknown[] | null };
            const flow = Array.isArray(result.flujo) ? result.flujo : [];
            return <div className="space-y-4"><PreviewLine label="Entendimiento del proceso">{result.resumen_ejecutivo || "Sin resumen ejecutivo registrado."}</PreviewLine><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[color:var(--fl-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--fl-text-3)]">{flow.length} pasos</span><span className="rounded-full bg-[color:var(--fl-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--fl-text-3)]">{result.actores_proceso.length} actores</span></div></div>;
        }
        case "policy-analysis-v1": {
            const result = content as PolicyAnalysisContent;
            return <div className="space-y-3"><p className="text-xs text-[color:var(--fl-text-3)]">{result.observaciones.length} observaciones · {result.necesidades.length} necesidades · {result.politicas.length} políticas recomendadas</p>{result.observaciones.slice(0, 2).map((item, index) => <div key={index} className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2.5"><PreviewLine label={`Observación ${index + 1}`}>{item.observacion}</PreviewLine></div>)}</div>;
        }
        case "policy-draft-v1": {
            const result = content as PolicyDraftContent;
            return <div className="space-y-4"><p className="text-sm font-semibold text-[color:var(--fl-text)]">{result.policyName}</p><PreviewLine label="Objetivo">{result.objetivo}</PreviewLine><PreviewLine label="Alcance">{result.alcance}</PreviewLine><p className="text-[11px] text-[color:var(--fl-text-4)]">{result.lineamientosGenerales.length} lineamientos generales · {result.lineamientosEspecificos.length} específicos</p></div>;
        }
        case "transcription-v1": {
            const result = content as TranscriptionContent;
            return <div className="space-y-3"><p className="text-xs text-[color:var(--fl-text-3)]">{result.segments.length} intervenciones registradas</p>{result.segments.slice(0, 3).map((segment) => <div key={segment.id} className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2.5"><p className="text-[11px] font-semibold text-[color:var(--fl-link)]">{segment.speaker || "Participante"}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-[color:var(--fl-text-3)]">{segment.editedText || segment.text}</p></div>)}</div>;
        }
        case "contrato-a": {
            const result = content as ContractA;
            const activities = result.nodes.filter((node) => !["startEvent", "endEvent"].includes(node.type));
            return <div className="space-y-4"><p className="text-sm font-semibold text-[color:var(--fl-text)]">{result.process.name}</p><div className="flex flex-wrap gap-2"><span className="rounded-full bg-[color:var(--fl-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--fl-text-3)]">{activities.length} actividades y decisiones</span><span className="rounded-full bg-[color:var(--fl-bg)] px-3 py-1 text-[11px] font-semibold text-[color:var(--fl-text-3)]">{result.lanes.filter((lane) => !lane.pending).length} responsables</span></div><ol className="space-y-1.5">{activities.slice(0, 4).map((node, index) => <li key={node.id} className="flex gap-2 text-xs text-[color:var(--fl-text-3)]"><span className="font-semibold text-[color:var(--fl-link)]">{index + 1}.</span><span className="line-clamp-2">{node.name}</span></li>)}</ol>{activities.length > 4 ? <p className="text-[11px] text-[color:var(--fl-text-4)]">Vista parcial de la secuencia. Abre el diagrama para ver conexiones y carriles.</p> : null}</div>;
        }
        case "translation-preview-v1": {
            const blocks = (content as Extract<NonNullable<DeliverablePreview["content"]>, { schemaVersion: "translation-preview-v1" }>).blocks;
            return <div className="space-y-2">{blocks.slice(0, 8).map((block, index) => <p key={index} className="text-xs leading-5 text-[color:var(--fl-text-2)]">{block.text}</p>)}</div>;
        }
        case "presentation-preview-v1": {
            const slides = (content as Extract<NonNullable<DeliverablePreview["content"]>, { schemaVersion: "presentation-preview-v1" }>).slides;
            return <div className="space-y-3">{slides.slice(0, 5).map((slide) => <div key={slide.number} className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] p-3"><p className="text-xs font-bold text-[color:var(--fl-text)]">Diapositiva {slide.number}{slide.title ? ` · ${slide.title}` : ""}</p>{slide.blocks?.slice(0, 3).map((block, index) => <p key={index} className="mt-1 text-xs leading-5 text-[color:var(--fl-text-3)]">{block.text}</p>)}</div>)}</div>;
        }
        default:
            return <p className="text-xs text-[color:var(--fl-text-4)]">La vista rápida de este formato no está disponible. El contenido completo sigue en el detalle.</p>;
    }
}

function PanelContent({ content, fullPreview }: { content: NonNullable<DeliverablePreview["content"]> | DeliverableJsonContent; fullPreview: boolean }) {
    if (content.schemaVersion === "document-v1") return <ChatMarkdown text={content.markdown} />;
    const supportsFullView = ["diagnostic-v1", "understanding-v1", "understanding-v2", "policy-analysis-v1", "policy-draft-v1"].includes(String(content.schemaVersion));
    if (fullPreview && content.schemaVersion === "contrato-a") return <Suspense fallback={<p role="status" className="text-xs text-[color:var(--fl-text-3)]">Cargando visor del diagrama…</p>}><FluDiagramPreview content={content as ContractA} /></Suspense>;
    if (fullPreview && content.schemaVersion === "translation-preview-v1") {
        const blocks = (content as Extract<NonNullable<DeliverablePreview["content"]>, { schemaVersion: "translation-preview-v1" }>).blocks;
        return <article className="flu-document-page" aria-label="Documento traducido">{blocks.map((block, index) => <p key={index} className={index ? "mt-4" : undefined}>{block.text}</p>)}</article>;
    }
    if (fullPreview && supportsFullView) return <Suspense fallback={<p role="status" className="text-xs text-[color:var(--fl-text-3)]">Cargando contenido…</p>}><DeliverableContentView content={content as DeliverableJsonContent} /></Suspense>;
    return <StructuredPreview content={content} />;
}

export function ConsultationDeliverableCard({ card, projectId, onOpenPanel, initiallyExpanded = false, fullPreview = false }: { card: Card; projectId: string; unitId: string; onOpenPanel?: () => void; initiallyExpanded?: boolean; fullPreview?: boolean }) {
    const location = useLocation();
    const editorQuery = new URLSearchParams({ project: projectId });
    const originChatId = new URLSearchParams(location.search).get("chat");
    if (originChatId) editorQuery.set("chat", originChatId);
    const [expanded, setExpanded] = useState(initiallyExpanded);
    const [preview, setPreview] = useState<Preview>({ state: "idle" });
    const [versions, setVersions] = useState<VersionList | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | undefined>(card.version?.id);
    const [downloadError, setDownloadError] = useState("");
    const previewId = useId();
    const hasVersion = Boolean(card.version?.number) && card.outcome !== "failed";
    const showPreview = fullPreview || expanded;
    const canPreviewInChat = ["diagnostic", "understanding", "policy_analysis", "policy_draft", "transcription", "translation"].includes(card.deliverableType);
    const selectedVersionNumber = versions?.versions.find((version) => version.id === selectedVersionId)?.number ?? card.version?.number;
    if (selectedVersionId) editorQuery.set("version", selectedVersionId);

    useEffect(() => {
        if (!showPreview || !fullPreview || !hasVersion) return;
        let active = true;
        void listDeliverableVersions(projectId, card.deliverableId).then((list) => { if (active) setVersions(list); }).catch(() => undefined);
        return () => { active = false; };
    }, [showPreview, fullPreview, hasVersion, projectId, card.deliverableId]);

    useEffect(() => {
        if (!showPreview || !hasVersion) return;
        let active = true;
        setPreview({ state: "loading" });
        const load = async () => {
            try {
                try {
                    const structured = await getDeliverablePreview(projectId, card.deliverableId, selectedVersionId);
                    if (selectedVersionId && structured.version.id !== selectedVersionId) throw new Error("La vista no corresponde a la versión solicitada");
                    if (fullPreview && card.deliverableType === "diagram_as_is" && (!structured.contentAvailable || !structured.content)) throw new Error("El diagrama necesita contenido completo");
                    if (fullPreview && card.deliverableType !== "diagram_as_is" && structured.formats.includes("pdf")) {
                        try {
                            const pdf = await downloadDeliverableVersion(projectId, card.deliverableId, structured.version.id, "pdf");
                            if (active) setPreview({ state: "presentation", pdf, formats: structured.formats });
                            return;
                        } catch {
                            // Mantener el contenido estructurado como alternativa; nunca
                            // descargar la versión vigente si se eligió una histórica.
                        }
                    }
                    if (fullPreview && structured.formats.includes("docx")) {
                        try {
                            const docx = await downloadDeliverableVersion(projectId, card.deliverableId, structured.version.id, "docx");
                            if (active) setPreview({ state: "document", docx, formats: structured.formats });
                            return;
                        } catch { /* Structured content remains available for this exact version. */ }
                    }
                    if (active) setPreview({ state: "structured", preview: structured });
                    return;
                } catch {
                    // La ruta nueva llega en un despliegue posterior. El fallback solo
                    // muestra contenido de la versión vigente, nunca lo atribuye a una anterior.
                }
                const deliverable = await getDeliverable(projectId, card.deliverableId);
                if (!active) return;
                if (selectedVersionId && selectedVersionNumber !== deliverable.currentVersion) {
                    try {
                        if (card.deliverableType === "presentation") {
                            const pdf = await downloadDeliverableVersion(projectId, card.deliverableId, selectedVersionId, "pdf");
                            if (active) setPreview({ state: "presentation", pdf });
                        } else if (card.deliverableType === "translation") {
                            if (active) setPreview({ state: "unavailable", reason: "Esta versión no tiene texto extraído para mostrar aquí. Puedes descargar su documento desde el detalle." });
                        } else {
                            const content = await getDeliverableVersionJson(projectId, card.deliverableId, selectedVersionId);
                            if (active) setPreview({ state: "content", content });
                        }
                    } catch (caught) {
                        if (active) setPreview(caught instanceof ApiServiceError && caught.code === "version_not_restorable"
                            ? { state: "historical", currentVersion: deliverable.currentVersion }
                            : { state: "unavailable", reason: "No se pudo cargar el contenido de esta versión." });
                    }
                    return;
                }
                if (card.deliverableType === "presentation") {
                    const pdf = await downloadDeliverable(projectId, card.deliverableId, "pdf");
                    if (active) setPreview({ state: "presentation", pdf });
                } else if (card.deliverableType === "translation") {
                    setPreview({ state: "unavailable", reason: "Este formato no tiene una representación visual breve en el chat." });
                } else {
                    const content = await getDeliverableJson(projectId, card.deliverableId);
                    if (active) setPreview({ state: "content", content });
                }
            } catch {
                if (active) setPreview({ state: "unavailable", reason: "No pude cargar la vista rápida. El entregable sigue disponible en su detalle." });
            }
        };
        void load();
        return () => { active = false; };
    }, [showPreview, fullPreview, hasVersion, projectId, card.deliverableId, card.deliverableType, card.version?.number, selectedVersionId, selectedVersionNumber]);

    const outcome = card.outcome === "generated" ? "Nueva versión" : card.outcome === "reused" ? "Reutilizado" : card.outcome === "kept" ? "Versión conservada" : "No generado";
    const downloadSelected = async (format?: DownloadFormat) => {
        if (!selectedVersionId) return;
        setDownloadError("");
        try {
            const blob = await downloadDeliverableVersion(projectId, card.deliverableId, selectedVersionId, format);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const mime = blob.type.toLowerCase();
            const extension = format ?? (mime.includes("markdown") || card.deliverableType === "document" ? "md" : mime.includes("pdf") ? "pdf" : mime.includes("spreadsheet") ? "xlsx" : mime.includes("presentation") ? "pptx" : mime.includes("wordprocessingml") ? "docx" : mime.includes("json") ? "json" : mime.includes("xml") && card.deliverableType === "diagram_as_is" ? "bpmn" : card.deliverableType === "presentation" ? "pptx" : card.deliverableType === "diagram_as_is" ? "json" : "docx");
            link.download = `${card.title || deliverableLabel(card.deliverableType)}-v${selectedVersionNumber ?? ""}.${extension}`;
            link.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (caught) {
            const state = caught instanceof ApiServiceError ? (caught.detail as { state?: string } | undefined)?.state : undefined;
            setDownloadError(caught instanceof ApiServiceError && caught.code === "representation_not_available" ? state === "preparing" ? "El PDF de esta versión se está preparando. Puedes descargar el original mientras tanto y volver a intentarlo después." : state === "failed" ? "No se pudo preparar el PDF de esta versión. El documento original sigue disponible." : caught.message : caught instanceof ApiServiceError && caught.code === "version_not_restorable" ? "Esta versión no conserva un archivo propio para descargar." : "No se pudo descargar esta versión.");
        }
    };

    if (fullPreview && hasVersion) {
        const formats = preview.state === "structured" ? preview.preview.formats : preview.state === "presentation" || preview.state === "document" ? preview.formats : undefined;
        return <section className="flu-deliverable-open-file" aria-label="Archivo del entregable">
            {card.deliverableType === "diagram_as_is" ? <Link className="flu-open-editor-link" to={`/flu/diagrams/${encodeURIComponent(card.deliverableId)}?${editorQuery}`}>Abrir editor BPMN ↗</Link> : null}
            <div className="flu-open-file-toolbar"><label>Versión <select aria-label="Versión del entregable" value={selectedVersionId ?? ""} onChange={(event) => setSelectedVersionId(event.target.value)}>{versions?.versions.length ? versions.versions.map((version) => <option key={version.id} value={version.id}>v{version.number}{version.id === versions.current ? " · vigente" : ""}</option>) : <option value={card.version?.id}>v{card.version?.number}</option>}</select></label><div><button type="button" disabled={preview.state === "loading" || preview.state === "idle" || preview.state === "historical"} onClick={() => void downloadSelected()}>Descargar original</button>{formats?.includes("pdf") || preview.state === "presentation" || card.deliverableType === "document" ? <button type="button" onClick={() => void downloadSelected("pdf")}>Descargar PDF</button> : formats ? <span className="flu-open-file-note">Esta versión no tiene PDF</span> : null}</div></div>
            {downloadError ? <p role="alert" className="flu-open-file-error">{downloadError}</p> : null}
            <div className={`flu-open-file-view ${preview.state === "presentation" || preview.state === "document" ? "is-document" : ""}`}>
                {preview.state === "loading" || preview.state === "idle" ? <p role="status" className="flu-source-preview-status">Abriendo documento…</p> : null}
                {preview.state === "presentation" ? <FluPdfDocument pdf={preview.pdf} edgeToEdge /> : null}
                {preview.state === "document" ? <FluDocxViewer blob={preview.docx} /> : null}
                {preview.state === "structured" ? preview.preview.contentAvailable && preview.preview.content ? <PanelContent content={preview.preview.content} fullPreview /> : <p className="flu-source-preview-status">Esta versión no tiene una vista disponible. Puedes descargar el original.</p> : null}
                {preview.state === "content" ? <PanelContent content={preview.content} fullPreview /> : null}
                {preview.state === "historical" ? <p className="flu-source-preview-status">Esta versión anterior no conserva contenido propio. La vigente es la {preview.currentVersion}; no mostramos su contenido como si fuera el anterior.</p> : null}
                {preview.state === "unavailable" ? <p className="flu-source-preview-status">{preview.reason}</p> : null}
            </div>
        </section>;
    }

    return <section className={fullPreview ? "flu-deliverable-open-file mt-3" : "flu-deliverable-card mt-3 overflow-hidden rounded-2xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)]"}>
        {!fullPreview ? <div className="flex flex-wrap items-start gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--fl-bg)] text-[color:var(--fl-link)] shadow-sm"><CardIcon type={card.deliverableType} /></span>
            <div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-[color:var(--fl-text)]">{"title" in card && typeof card.title === "string" && card.title.trim() ? card.title : deliverableLabel(card.deliverableType)}{card.version ? ` · versión ${card.version.number}` : ""}</p><p className="mt-0.5 text-[11px] font-medium text-[color:var(--fl-text-4)]">{outcome}</p>{card.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--fl-text-3)]">{card.summary}</p> : null}</div>
            {hasVersion && !fullPreview && (canPreviewInChat || !onOpenPanel) ? <button type="button" aria-expanded={expanded} aria-controls={previewId} onClick={() => setExpanded((current) => !current)} className="flu-preview-toggle flex shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2 text-[11px] font-semibold text-[color:var(--fl-link)]">{expanded ? "Ocultar vista" : onOpenPanel ? "Leer aquí" : "Vista rápida"}<ChevronRight className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" /></button> : null}
            {hasVersion && onOpenPanel ? <button type="button" onClick={onOpenPanel} className="flu-preview-toggle flex shrink-0 items-center gap-1.5 rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2 text-[11px] font-semibold text-[color:var(--fl-link)]">Ver entregable<ChevronRight className="size-4" aria-hidden="true" /></button> : null}
        </div> : null}
        {showPreview && hasVersion ? <div id={previewId} className={`flu-inline-preview ${fullPreview ? "flu-open-file-content" : "border-t border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] p-4"}`}>
            {fullPreview && versions?.versions.length ? <label className="mb-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--fl-text-2)]">Versión <select value={selectedVersionId ?? card.version?.id ?? ""} onChange={(event) => setSelectedVersionId(event.target.value)} className="rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-2 py-1.5">{versions.versions.map((version) => <option key={version.id} value={version.id}>v{version.number}{version.id === versions.current ? " · vigente" : ""}</option>)}</select></label> : null}
            {preview.state === "loading" || preview.state === "idle" ? <div role="status" className="space-y-2"><div className="flu-skeleton h-4 w-2/3 rounded-md" /><div className="flu-skeleton h-3 w-full rounded-md" /><span className="sr-only">Cargando vista rápida</span></div> : null}
            {preview.state === "content" ? <PanelContent content={preview.content} fullPreview={fullPreview} /> : null}
            {preview.state === "structured" ? <div className="space-y-3"><p className="text-xs font-bold text-[color:var(--fl-text)]">{preview.preview.title} · versión {preview.preview.version.number}</p>{preview.preview.contentAvailable && preview.preview.content ? <PanelContent content={preview.preview.content} fullPreview={fullPreview} /> : <p className="text-xs leading-5 text-[color:var(--fl-text-3)]">Esta versión no tiene contenido estructurado para mostrar aquí.</p>}{fullPreview && preview.preview.formats.length ? <div className="flex flex-wrap gap-2">{preview.preview.formats.map((format) => <button key={format} type="button" onClick={() => void downloadSelected(format)} className="flu-preview-toggle rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--fl-link)]">Descargar {format.toUpperCase()}</button>)}</div> : null}{downloadError ? <p role="alert" className="text-xs text-[color:var(--fl-error-text)]">{downloadError}</p> : null}</div> : null}
            {preview.state === "presentation" ? <div className="space-y-3"><InlinePresentationPreview pdf={preview.pdf} noun={card.deliverableType === "presentation" ? "diapositiva" : "página"} />{fullPreview && preview.formats?.length ? <div className="flex flex-wrap gap-2">{preview.formats.map((format) => <button key={format} type="button" onClick={() => void downloadSelected(format)} className="flu-preview-toggle rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--fl-link)]">Descargar {format.toUpperCase()}</button>)}</div> : null}{downloadError ? <p role="alert" className="text-xs text-[color:var(--fl-error-text)]">{downloadError}</p> : null}</div> : null}
            {preview.state === "historical" ? <p className="text-xs leading-5 text-[color:var(--fl-text-3)]">Esta versión anterior no conserva contenido propio. La vigente es la {preview.currentVersion}; no mostramos su contenido como si fuera el anterior.</p> : null}
            {preview.state === "unavailable" ? <p className="text-xs leading-5 text-[color:var(--fl-text-3)]">{preview.reason}</p> : null}
        </div> : null}
    </section>;
}
