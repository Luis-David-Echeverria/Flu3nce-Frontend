// Etiquetas de UI para los tipos de entregable del contrato. Un solo lugar para el
// vocabulario (evita "Fin" vs "Fin del proceso" repartido por pantallas).
import type { DeliverableType } from "./types";

export const DELIVERABLE_LABELS: Record<DeliverableType, string> = {
    understanding: "Documento de entendimiento",
    diagnostic: "Diagnóstico 6D",
    diagram_as_is: "Diagrama As-Is",
    policy_analysis: "Análisis de necesidades",
    policy_draft: "Política",
    presentation: "Presentación ejecutiva",
    translation: "Traducción",
    transcription: "Transcripción",
    generic: "Documento",
    document: "Documento",
};

const DELIVERABLE_EXT: Record<DeliverableType, string> = {
    understanding: "docx",
    diagnostic: "docx",
    diagram_as_is: "bpmn",
    policy_analysis: "docx",
    policy_draft: "docx",
    presentation: "pptx",
    translation: "docx",
    transcription: "docx",
    generic: "",
    document: "md",
};

export const deliverableLabel = (t: DeliverableType): string => DELIVERABLE_LABELS[t] ?? t;

/** Nombre de archivo sugerido para íconos/descargas (el back define el real). */
export const deliverableFileName = (t: DeliverableType): string => t === "generic" ? deliverableLabel(t) : `${deliverableLabel(t)}.${DELIVERABLE_EXT[t] ?? "docx"}`;

export const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
    generating: "Generando…",
    needs_input: "Requiere información",
    ready: "Listo",
    failed: "Falló",
};
