import type { components } from "@/lib/api-schema";
import { announceSessionExpired } from "@/lib/session-expiry";
import { apiError, fetchError, V2 } from "./http";

export type UploadBatch = components["schemas"]["UploadBatch"];
export type Upload = components["schemas"]["Upload"];
export type UploadBatchRequest = components["schemas"]["UploadBatchRequest"];
const chatUrl = (chatId: string) => `${V2}/chats/${encodeURIComponent(chatId)}`;
const batchUrl = (chatId: string, id: string) => `${chatUrl(chatId)}/upload-batches/${encodeURIComponent(id)}`;
const uploadUrl = (chatId: string, id: string) => `${chatUrl(chatId)}/uploads/${encodeURIComponent(id)}`;

async function request<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch(url, { method, credentials: "include", signal, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
    if (!response.ok) throw await fetchError(response, "No se pudo actualizar la subida de archivos");
    if (response.status === 202 && method === "DELETE") return undefined as T;
    return response.json();
}

export const createUploadBatch = (chatId: string, body: UploadBatchRequest, signal?: AbortSignal) => request<UploadBatch>(`${chatUrl(chatId)}/upload-batches`, "POST", body, signal);
export const getUploadBatch = (chatId: string, batchId: string) => request<UploadBatch>(batchUrl(chatId, batchId));
export const getUpload = (chatId: string, uploadId: string) => request<Upload>(uploadUrl(chatId, uploadId));
export const completeUpload = (chatId: string, uploadId: string, signal?: AbortSignal) => request<Upload>(`${uploadUrl(chatId, uploadId)}/complete`, "POST", undefined, signal);
export const cancelUpload = (chatId: string, uploadId: string) => request<void>(uploadUrl(chatId, uploadId), "DELETE");
export const cancelUploadBatch = (chatId: string, batchId: string) => request<void>(batchUrl(chatId, batchId), "DELETE");

/** Hash only one bounded slice at a time, never the complete multi-GB file. */
export async function sha256(blob: Blob): Promise<string> {
    const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Helps reject a different same-name file when reselecting after a page reload. */
export const fileFingerprint = (file: File) => sha256(new Blob([file.slice(0, 1024 * 1024), file.slice(Math.max(0, file.size - 1024 * 1024))]));

export function uploadPart(chatId: string, uploadId: string, part: number, bytes: Blob, digest: string, signal: AbortSignal, onProgress: (loaded: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) { reject(new DOMException("Cancelado", "AbortError")); return; }
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        const cleanup = () => signal.removeEventListener("abort", abort);
        xhr.open("PUT", `${uploadUrl(chatId, uploadId)}/parts/${part}`);
        xhr.withCredentials = true;
        xhr.timeout = 180000;
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.setRequestHeader("Content-SHA256", digest);
        xhr.upload.onprogress = (event) => onProgress(event.loaded);
        xhr.onerror = () => { cleanup(); reject(new TypeError("Se interrumpió la conexión durante la subida")); };
        xhr.ontimeout = () => { cleanup(); reject(new TypeError("La conexión tardó demasiado; puedes reanudar la subida")); };
        xhr.onabort = () => { cleanup(); reject(new DOMException("Cancelado", "AbortError")); };
        xhr.onload = () => {
            cleanup();
            if (xhr.status === 401) announceSessionExpired();
            let payload: unknown;
            try { payload = JSON.parse(xhr.responseText); } catch { payload = undefined; }
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(apiError(payload, "No se pudo subir esta parte del archivo"));
        };
        signal.addEventListener("abort", abort, { once: true });
        xhr.send(bytes);
    });
}
