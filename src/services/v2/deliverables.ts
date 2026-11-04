// Entregables v2 — reemplaza a processing-service/pipeline-service (v1: transcribir/
// estructura/tabla/visio encadenados en el front). Acá las features son DATOS: se piden
// todas igual (POST …/deliverables { type, from?, options? }) y el back orquesta → job.
import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError, fetchError, V2 } from "./http";
import type { Deliverable, DeliverableJsonContent, DeliverablePreview, DeliverableType, JobRef, VersionList } from "./types";
import type { paths } from "@/lib/api-schema";
export type DownloadFormat = NonNullable<paths["/projects/{projectId}/deliverables/{deliverableId}/versions/{versionId}/content"]["get"]["parameters"]["query"]>["format"];

export async function listDeliverables(
    projectId: string,
    opts?: { unitId?: string; type?: DeliverableType; limit?: number; cursor?: string },
): Promise<{ deliverables: Deliverable[]; nextCursor?: string }> {
    if (isMockMode) return { deliverables: (await import("@/mocks/api-store")).mockListDeliverables(projectId, opts) };
    const { data, error } = await api.GET("/projects/{projectId}/deliverables", {
        params: { path: { projectId }, query: { unitId: opts?.unitId, type: opts?.type, limit: opts?.limit, cursor: opts?.cursor } },
    });
    if (error || !data) throw apiError(error, "No se pudieron cargar los entregables");
    return { deliverables: data.deliverables ?? [], nextCursor: data.nextCursor ?? undefined };
}

export async function getDeliverable(projectId: string, deliverableId: string): Promise<Deliverable> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
    const { data, error } = await api.GET("/projects/{projectId}/deliverables/{deliverableId}", {
        params: { path: { projectId, deliverableId } },
    });
    if (error || !data) throw apiError(error, "No se encontró el entregable");
    return data;
}

/** Vista estructurada de una versión, sin descargar ni interpretar el documento. */
export async function getDeliverablePreview(projectId: string, deliverableId: string, versionId?: string): Promise<DeliverablePreview> {
    if (isMockMode) {
        const deliverable = (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
        const number = Number(versionId?.match(/(\d+)$/)?.[1] ?? deliverable.currentVersion);
        const note = (await import("@/mocks/api-store")).mockGetChatPreviewNote(deliverableId, number);
        let content: DeliverablePreview["content"];
        if (deliverable.type === "presentation") content = { schemaVersion: "presentation-preview-v1", slides: [
            { number: 1, title: note || "Contexto y objetivo", blocks: [{ kind: "paragraph", text: "Resumen ejecutivo del proceso de ejemplo." }] },
            { number: 2, title: "Situación actual", blocks: [{ kind: "paragraph", text: "Hallazgos, responsables y puntos de decisión." }] },
            { number: 3, title: "Próximos pasos", blocks: [{ kind: "paragraph", text: "Acciones propuestas para validar con el equipo." }] },
        ] };
        else if (deliverable.type === "translation") content = { schemaVersion: "translation-preview-v1", blocks: [{ kind: "paragraph", text: note || "Texto de ejemplo traducido para esta vista local." }] };
        else {
            const base = (await import("@/mocks/api-store")).mockGetDeliverableContent(deliverable.type);
            if (deliverable.type === "policy_draft" && note && base.schemaVersion === "policy-draft-v1") {
                const purchases = /compra/i.test(note) || (projectId === "prj_mock_reclutamiento" && deliverableId === "dlv_mock_policy_draft");
                const normalizedNote = note.toLocaleLowerCase("es-MX");
                const approver = normalizedNote.lastIndexOf("finanzas") > Math.max(normalizedNote.lastIndexOf("dirección"), normalizedNote.lastIndexOf("direccion")) ? "Finanzas" : normalizedNote.includes("dirección") || normalizedNote.includes("direccion") ? "Dirección" : "Finanzas";
                content = { ...base,
                    policyName: purchases ? "Política de compras menores" : /^política/i.test(note) ? note : "Política de ejemplo",
                    policyCode: purchases ? "COM-POL-001" : "DEMO-POL-001",
                    policyType: purchases ? "Compras" : "Demostración",
                    objetivo: purchases ? "Establecer criterios claros para solicitar, aprobar y registrar compras menores." : `Objetivo de ejemplo basado en: ${note}`,
                    alcance: purchases ? "Todas las áreas; compras de hasta $10,000." : "Alcance de ejemplo para validar la interfaz.",
                    definiciones: purchases ? [{ termino: "Compra menor", definicion: "Adquisición de hasta $10,000." }] : [],
                    lineamientosGenerales: purchases ? ["Toda solicitud debe indicar necesidad, monto y área solicitante."] : [`Regla de ejemplo: ${note}`],
                    lineamientosEspecificos: purchases ? [`${approver} aprueba las compras menores a $10,000.`, "Finanzas registra la compra y conserva la evidencia."] : ["Validar responsables y excepciones antes de publicar."],
                    coordinacionInterdepartamental: purchases ? "El área solicitante, Dirección y Finanzas coordinan la aprobación y el registro." : "Coordinación por definir.",
                    responsables: purchases ? { dirección: "Aprobar", finanzas: "Registrar", áreaSolicitante: "Solicitar" } : { responsable: "Por definir" },
                };
            } else if (deliverable.type === "diagram_as_is" && note && base.schemaVersion === "contrato-a" && /compra/i.test(note)) {
                const steps = ["Solicitud de compra", "Registrar necesidad", "Revisar presupuesto", "¿Solicitud completa?", "Enviar a aprobación", "Adjuntar cotización", "Evaluar compra", "¿Se aprueba?", "Emitir orden", "Registrar adquisición", "Compra completada", "Solicitud rechazada"];
                content = { ...base, process: { ...base.process, name: "Proceso de compras menores", description: "Secuencia demostrativa de solicitud, aprobación y registro." },
                    lanes: base.lanes.map((lane, index) => ({ ...lane, name: ["Área solicitante", "Finanzas", "Proveedor", "Dirección"][index] })),
                    nodes: base.nodes.map((node, index) => ({ ...node, name: steps[index] })) };
            } else content = base;
        }
        return { deliverableId, projectId, unitId: deliverable.unitId, deliverableType: deliverable.type,
            title: deliverable.title ?? note ?? deliverable.type, status: deliverable.status,
            version: { id: versionId ?? `ver_mock_${number}`, number, createdAt: deliverable.updatedAt ?? deliverable.createdAt, origin: "real" },
            isCurrentVersion: number === deliverable.currentVersion, formats: deliverable.type === "presentation" ? ["pdf", "pptx"] : ["json"],
            contentAvailable: true, content };
    }
    const { data, error } = await api.GET("/projects/{projectId}/deliverables/{deliverableId}/preview", {
        params: { path: { projectId, deliverableId }, query: { versionId } },
    });
    if (error || !data) throw apiError(error, "No se pudo cargar la vista previa");
    return data;
}

/**
 * Genera un entregable. Mismo endpoint para toda feature — cambia el `type`.
 * Async: devuelve un JobRef; el resultado se sigue con el hook useJob / getJob.
 */
export async function createDeliverable(
    projectId: string,
    req: { unitId: string; type: DeliverableType; from?: string[]; options?: Record<string, unknown>; confirmReplaceManual?: boolean },
): Promise<JobRef> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockCreateDeliverable(projectId, req);
    const { data, error } = await api.POST("/projects/{projectId}/deliverables", {
        params: { path: { projectId } },
        body: req,
    });
    if (error || !data) throw apiError(error, "No se pudo generar el entregable");
    return data;
}

/**
 * URL del contenido de la versión vigente. `format` (opcional) pide una representación
 * concreta: omitido = la canónica del type; `docx`/`pdf` = el export (para "Exportar").
 */
export function deliverableContentUrl(projectId: string, deliverableId: string, format?: string): string {
    if (isMockMode) {
        return `data:text/plain;charset=utf-8,${encodeURIComponent(`Entregable mock: ${deliverableId} (${format ?? "canónico"})`)}`;
    }
    const base = `${V2}/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/content`;
    return format ? `${base}?format=${encodeURIComponent(format)}` : base;
}

async function mockPresentationPdf(projectId: string, deliverableId: string, versionId?: string): Promise<Blob> {
    const { jsPDF } = await import("jspdf");
    const preview = await getDeliverablePreview(projectId, deliverableId, versionId);
    const slides = preview.content?.schemaVersion === "presentation-preview-v1" ? preview.content.slides : [];
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    slides.forEach((slide, index) => {
        if (index) pdf.addPage("a4", "landscape");
        pdf.setFillColor(19, 54, 104);
        pdf.rect(0, 0, 842, 595, "F");
        pdf.setFillColor(39, 132, 190);
        pdf.rect(54, 52, 72, 5, "F");
        pdf.setTextColor(224, 241, 255);
        pdf.setFontSize(13);
        pdf.text(`FLU3NCE  /  ${String(index + 1).padStart(2, "0")}`, 54, 93);
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(31);
        pdf.text(pdf.splitTextToSize(slide.title || `Diapositiva ${slide.number}`, 720), 54, 175);
        pdf.setFontSize(17);
        pdf.setTextColor(210, 230, 246);
        slide.blocks?.forEach((block, blockIndex) => pdf.text(pdf.splitTextToSize(block.text, 705), 54, 280 + blockIndex * 76));
        pdf.setFontSize(11);
        pdf.text(`${index + 1} / ${slides.length}`, 746, 548);
    });
    return pdf.output("blob");
}

export async function downloadDeliverable(projectId: string, deliverableId: string, format?: string): Promise<Blob> {
    if (isMockMode) return format === "pdf" && (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId).type === "presentation" ? mockPresentationPdf(projectId, deliverableId) : (await import("@/mocks/api-store")).mockBlob(`${(await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId).type}.${format ?? "bin"}`);
    const res = await fetch(deliverableContentUrl(projectId, deliverableId, format), { credentials: "include" });
    if (!res.ok) throw await fetchError(res, "No se pudo descargar el entregable");
    return res.blob();
}

/** Lee exactamente la versión pedida; nunca sustituye silenciosamente por la vigente. */
export async function downloadDeliverableVersion(projectId: string, deliverableId: string, versionId: string, format?: DownloadFormat): Promise<Blob> {
    if (isMockMode) return format === "pdf" && (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId).type === "presentation" ? mockPresentationPdf(projectId, deliverableId, versionId) : (await import("@/mocks/api-store")).mockBlob(`${(await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId).type}.${format ?? "bin"}`);
    const base = `${V2}/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/versions/${encodeURIComponent(versionId)}/content`;
    const url = format ? `${base}?format=${format}` : base;
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) throw await fetchError(response, "No se pudo cargar esa versión");
    return response.blob();
}

export async function getDeliverableVersionJson(projectId: string, deliverableId: string, versionId: string): Promise<DeliverableJsonContent> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockGetDeliverableContent((await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId).type);
    const base = `${V2}/projects/${encodeURIComponent(projectId)}/deliverables/${encodeURIComponent(deliverableId)}/versions/${encodeURIComponent(versionId)}/content?format=json`;
    const response = await fetch(base, { credentials: "include", headers: { accept: "application/json" } });
    if (!response.ok) throw await fetchError(response, "No se pudo cargar esa versión");
    return response.json();
}

/** Contenido JSON de la versión vigente (para entregables estructurados, ej. el diagrama). */
export async function getDeliverableJson<T = DeliverableJsonContent>(projectId: string, deliverableId: string): Promise<T> {
    if (isMockMode) {
        const deliverable = (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
        return (await import("@/mocks/api-store")).mockGetDeliverableContent(deliverable.type) as T;
    }
    const res = await fetch(deliverableContentUrl(projectId, deliverableId, "json"), {
        credentials: "include",
        headers: { accept: "application/json" },
    });
    if (!res.ok) throw await fetchError(res, "No se pudo cargar el contenido");
    return res.json();
}

/** Choque de concurrencia: otra persona guardó una versión más nueva (PUT + If-Match → 412). */
export class DeliverableConflictError extends Error {
    constructor() {
        super("El entregable cambió desde que lo abriste. Recárgalo para no pisar la versión más reciente.");
        this.name = "DeliverableConflictError";
    }
}

/** Guarda una edición del usuario → nueva versión (atómico, versionado por el back).
 *  `ifMatch` = versión que cargaste: el back responde 412 si alguien más guardó primero
 *  (sin el header, último gana). */
export async function saveDeliverableContent(
    projectId: string,
    deliverableId: string,
    content: Blob | object,
    ifMatch?: number,
): Promise<Deliverable> {
    if (isMockMode) {
        if (content instanceof Blob) return (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
        const deliverable = (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
        if (deliverable.type === "diagram_as_is") return (await import("@/mocks/api-store")).mockSaveDiagramContent(projectId, deliverableId, content as import("./types").ContractA);
        return (await import("@/mocks/api-store")).mockSaveTranscriptionContent(projectId, deliverableId, content as import("./types").TranscriptionContent);
    }
    const isBlob = content instanceof Blob;
    const headers: Record<string, string> = { "content-type": isBlob ? "application/octet-stream" : "application/json" };
    if (ifMatch != null) headers["If-Match"] = String(ifMatch);
    const res = await fetch(deliverableContentUrl(projectId, deliverableId), {
        method: "PUT",
        credentials: "include",
        headers,
        body: isBlob ? content : JSON.stringify(content),
    });
    if (res.status === 412) throw new DeliverableConflictError();
    if (!res.ok) throw await fetchError(res, "No se pudo guardar el entregable");
    return res.json();
}

export async function listDeliverableVersions(projectId: string, deliverableId: string): Promise<VersionList> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockVersionList(deliverableId);
    const { data, error } = await api.GET("/projects/{projectId}/deliverables/{deliverableId}/versions", {
        params: { path: { projectId, deliverableId } },
    });
    if (error || !data) throw apiError(error, "No se pudo cargar el historial");
    return data;
}

export async function restoreDeliverableVersion(
    projectId: string,
    deliverableId: string,
    versionId: string,
): Promise<Deliverable> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockGetDeliverable(projectId, deliverableId);
    const { data, error } = await api.POST(
        "/projects/{projectId}/deliverables/{deliverableId}/versions/{versionId}/restore",
        { params: { path: { projectId, deliverableId, versionId } } },
    );
    if (error || !data) throw apiError(error, "No se pudo restaurar la versión");
    return data;
}
