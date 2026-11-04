// Fuentes v2 — reemplaza a nodes-service (v1: nodes/upload/download/versions).
// "Una sola caja": todo archivo de contexto es una Source; el back elige qué usar.
// Subir es atómico y versionado (el back devuelve la Source ya versionada o un Error).
import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError, fetchError, V2 } from "./http";
import type { Source, VersionList } from "./types";

export async function listSources(
    projectId: string,
    opts?: { limit?: number; cursor?: string },
): Promise<{ sources: Source[]; nextCursor?: string }> {
    if (isMockMode) return { sources: (await import("@/mocks/api-store")).mockListSources(projectId) };
    const { data, error } = await api.GET("/projects/{projectId}/sources", {
        params: { path: { projectId }, query: { limit: opts?.limit, cursor: opts?.cursor } },
    });
    if (error || !data) throw apiError(error, "No se pudieron cargar las fuentes");
    return { sources: data.sources ?? [], nextCursor: data.nextCursor ?? undefined };
}

export async function getSource(projectId: string, sourceId: string): Promise<Source> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockGetSource(projectId, sourceId);
    const { data, error } = await api.GET("/projects/{projectId}/sources/{sourceId}", {
        params: { path: { projectId, sourceId } },
    });
    if (error || !data) throw apiError(error, "No se encontró la fuente");
    return data;
}

/** Sube un archivo de contexto (multipart). Atómico + versionado por el back. */
export async function uploadSource(projectId: string, file: File, comment?: string): Promise<Source> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockUploadSource(projectId, file);
    const form = new FormData();
    form.append("file", file);
    if (comment) form.append("comment", comment);
    const res = await fetch(`${V2}/projects/${encodeURIComponent(projectId)}/sources`, {
        method: "POST",
        body: form,
        credentials: "include",
    });
    if (!res.ok) throw await fetchError(res, "No se pudo subir el archivo");
    return res.json();
}

export async function deleteSource(projectId: string, sourceId: string): Promise<void> {
    if (isMockMode) { (await import("@/mocks/api-store")).mockDeleteSource(projectId, sourceId); return; }
    const { error } = await api.DELETE("/projects/{projectId}/sources/{sourceId}", {
        params: { path: { projectId, sourceId } },
    });
    if (error) throw apiError(error, "No se pudo eliminar la fuente");
}

/** URL directa al contenido vigente (para <img>, <a> o abrir en pestaña). */
export function sourceContentUrl(projectId: string, sourceId: string): string {
    if (isMockMode) {
        return `data:text/plain;charset=utf-8,${encodeURIComponent(`Vista mock de ${sourceId}`)}`;
    }
    return `${V2}/projects/${encodeURIComponent(projectId)}/sources/${encodeURIComponent(sourceId)}/content`;
}

export async function downloadSource(projectId: string, sourceId: string): Promise<Blob> {
    if (isMockMode) {
        let source: Source;
        let uploaded: Blob | undefined;
        try { source = (await import("@/mocks/api-store")).mockGetSource(projectId, sourceId); }
        catch {
            const { mockGetChatSource, mockGetChatSourceBlob } = await import("@/mocks/chat-store");
            source = mockGetChatSource(projectId, sourceId);
            uploaded = mockGetChatSourceBlob(sourceId);
        }
        if (uploaded) return uploaded;
        if (source.mime === "application/pdf") {
            const { jsPDF } = await import("jspdf");
            const document = new jsPDF();
            document.setFontSize(16);
            document.text("Documento de ejemplo", 20, 30);
            document.setFontSize(11);
            document.text("Proceso de compras menores - datos sinteticos.", 20, 45);
            return document.output("blob");
        }
        return (await import("@/mocks/api-store")).mockBlob(source.name);
    }
    const res = await fetch(sourceContentUrl(projectId, sourceId), { credentials: "include" });
    if (!res.ok) throw await fetchError(res, "No se pudo descargar el archivo");
    return res.blob();
}

export async function listSourceVersions(projectId: string, sourceId: string): Promise<VersionList> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockSourceVersionList(sourceId);
    const { data, error } = await api.GET("/projects/{projectId}/sources/{sourceId}/versions", {
        params: { path: { projectId, sourceId } },
    });
    if (error || !data) throw apiError(error, "No se pudo cargar el historial de versiones");
    return data;
}
