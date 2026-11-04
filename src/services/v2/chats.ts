/** Chat services typed against the pinned shared contract. */
import { ApiServiceError, apiError, fetchError, V2 } from "./http";
import { isMockMode } from "@/config/api-mode";
import { readSse, type SseEvent } from "./sse";
import { announceSessionExpired } from "@/lib/session-expiry";
import type { components } from "@/lib/api-schema";
import type { ConsultationMessage, ContextContribution, JobRef, Source } from "./types";

export type Chat = components["schemas"]["Chat"];
export type ChatSession = Omit<components["schemas"]["ChatSession"], "messages"> & { messages: ConsultationMessage[] };
export type ChatMovePreview = components["schemas"]["ChatMovePreview"];
export type ChatExchange = Omit<components["schemas"]["ConsultationExchange"], "userMessage" | "reply"> & { userMessage: ConsultationMessage; reply: ConsultationMessage };
export type ChatExchangeWithFiles = Omit<components["schemas"]["ChatExchangeWithFiles"], "userMessage" | "reply"> & { userMessage: ConsultationMessage; reply: ConsultationMessage };
export type ChatMessageOptions = { model?: string; attachmentIds?: string[] };

const chatUrl = (chatId: string) => `${V2}/chats/${encodeURIComponent(chatId)}`;

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { credentials: "include", ...init });
    if (!response.ok) throw await fetchError(response, "No se pudo completar la operación del chat");
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
}

function jsonBody(body: object): RequestInit {
    return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

export async function listChats(scope: { projectId: string } | { unassigned: true }, cursor?: string, limit = 50): Promise<{ chats: Chat[]; nextCursor?: string }> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockListChats(scope);
    const query = new URLSearchParams("projectId" in scope ? { projectId: scope.projectId } : { unassigned: "true" });
    query.set("limit", String(limit));
    if (cursor) query.set("cursor", cursor);
    return jsonRequest(`${V2}/chats?${query}`);
}

export async function createChat(title: string, projectId?: string): Promise<Chat> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockCreateChat(title, projectId);
    return jsonRequest(`${V2}/chats`, { method: "POST", ...jsonBody({ title, ...(projectId ? { projectId } : {}) }) });
}

export async function updateChat(chatId: string, patch: { title?: string; shared?: boolean }): Promise<Chat> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockUpdateChat(chatId, patch);
    return jsonRequest(chatUrl(chatId), { method: "PATCH", ...jsonBody(patch) });
}

export async function getChat(chatId: string, cursor?: string): Promise<ChatSession> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockGetChat(chatId, cursor);
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    return jsonRequest(`${chatUrl(chatId)}?${query}`);
}

/** Sondeo incremental: evita descargar de nuevo toda la página del historial. */
export async function getChatUpdates(chatId: string, since: string): Promise<ChatSession> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockGetChat(chatId, undefined, since);
    const query = new URLSearchParams({ limit: "200", since });
    return jsonRequest(`${chatUrl(chatId)}?${query}`);
}

/** Conserva la página inicial y añade solo eventos nuevos, en orden descendente. */
export function mergeChatUpdates(current: ChatSession, updates: ChatSession): ChatSession {
    const previous = new Map(current.messages.map((message) => [message.id, message]));
    const seen = new Set<string>();
    const messages = [...updates.messages, ...current.messages].filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
    });
    const messagesChanged = updates.messages.some((message) => {
        const old = previous.get(message.id);
        return !old || JSON.stringify(old) !== JSON.stringify(message);
    });
    const pendingChanged = JSON.stringify(current.pendingIntentIds ?? []) !== JSON.stringify(updates.pendingIntentIds ?? []);
    const chatChanged = current.chat.updatedAt !== updates.chat.updatedAt || current.chat.shared !== updates.chat.shared || current.chat.access !== updates.chat.access;
    const flagsChanged = current.freeMessagesEnabled !== updates.freeMessagesEnabled || current.revisionIntentsEnabled !== updates.revisionIntentsEnabled;
    if (!messagesChanged && !pendingChanged && !chatChanged && !flagsChanged) return current;
    return { ...current, ...updates, messages, nextCursor: current.nextCursor };
}

/** Replayed events replace their original entry instead of moving it to the end of the chat. */
export function mergeChatEventMessage(current: ChatSession, message: ConsultationMessage): ChatSession {
    const found = current.messages.find((item) => item.id === message.id);
    if (found && JSON.stringify(found) === JSON.stringify(message)) return current;
    return { ...current, messages: found ? current.messages.map((item) => item.id === message.id ? message : item) : [message, ...current.messages] };
}

export async function sendChatMessage(chatId: string, text: string, clientMessageId: string, options: ChatMessageOptions = {}): Promise<ChatExchange> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockSendChatMessage(chatId, text, clientMessageId);
    return jsonRequest(`${chatUrl(chatId)}/messages`, { method: "POST", ...jsonBody({ text, clientMessageId, ...options }) });
}

/** Invalid, empty multipart has no effects. 400/422 means the route is enabled. */
export async function chatFilesEnabled(chatId: string): Promise<boolean> {
    if (isMockMode) return false;
    const response = await fetch(`${chatUrl(chatId)}/messages-with-files`, { method: "POST", credentials: "include", body: new FormData() });
    if (response.status === 400 || response.status === 422) return true;
    if (response.status === 404) {
        const error = await fetchError(response, "No se pudo consultar el envío de adjuntos");
        if (error instanceof ApiServiceError && error.code === "not_found") return false;
        throw error;
    }
    if (!response.ok) throw await fetchError(response, "No se pudo consultar el envío de adjuntos");
    throw new Error("La comprobación de adjuntos devolvió un resultado inesperado");
}

/** Multipart keeps one user turn; XHR exposes real upload progress for the tray. */
export async function sendChatMessageWithFiles(chatId: string, text: string, files: File[], clientMessageId: string, model: string | undefined, onProgress: (percent: number) => void): Promise<ChatExchangeWithFiles> {
    const body = new FormData();
    body.append("text", text);
    body.append("clientMessageId", clientMessageId);
    if (model) body.append("model", model);
    for (const file of files) body.append("files", file, file.name);
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open("POST", `${chatUrl(chatId)}/messages-with-files`);
        request.withCredentials = true;
        request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.min(100, Math.round(event.loaded / event.total * 100))); };
        request.onerror = () => reject(new Error("Se interrumpió la subida de los archivos"));
        request.onload = () => {
            if (request.status === 401) announceSessionExpired();
            let payload: unknown;
            try { payload = JSON.parse(request.responseText); } catch { payload = null; }
            if (request.status >= 200 && request.status < 300) {
                if (payload && typeof payload === "object" && "reply" in payload) resolve(payload as ChatExchangeWithFiles);
                else reject(new Error("La respuesta del envío no tiene el intercambio esperado"));
            } else reject(apiError(payload, "No se pudo enviar el mensaje con archivos"));
        };
        request.send(body);
    });
}

export type ChatStreamEvent = SseEvent;
export type CancelledChatTurn = { cancelled: true; turnId: string; saved?: components["schemas"]["CancelSaved"][]; stoppedJobs?: string[] };

/** Legacy text and phase-B events share one stream; cancellation is a normal terminal result. */
export async function streamChatMessage(chatId: string, text: string, clientMessageId: string, options: ChatMessageOptions, onEvent: (event: ChatStreamEvent) => void, signal?: AbortSignal): Promise<ChatExchange | CancelledChatTurn | null> {
    if (isMockMode) return null;
    const response = await fetch(`${chatUrl(chatId)}/messages-stream`, {
        method: "POST", credentials: "include", signal,
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ text, clientMessageId, ...options }),
    });
    if (response.status === 404) {
        const error = await fetchError(response, "No se pudo iniciar el stream");
        if (error instanceof ApiServiceError && error.code === "not_found") return null;
        throw error;
    }
    if (!response.ok) throw await fetchError(response, "No se pudo iniciar el stream");
    let exchange: ChatExchange | null = null, completed = false;
    let cancelled: CancelledChatTurn | null = null;
    await readSse(response, (frame) => {
        const { event, data } = frame;
        if (event === "error") { onEvent(frame); throw apiError(data, "No se pudo completar la respuesta"); }
        if (event === "message") exchange = data as ChatExchange;
        if (event === "done") {
            completed = true;
            if (exchange) exchange = { ...exchange, ...(typeof data.outcome === "string" ? { outcome: data.outcome as ChatExchange["outcome"] } : {}), ...(data.failure ? { failure: data.failure as ChatExchange["failure"] } : {}), ...(Array.isArray(data.permissionsPending) ? { permissionsPending: data.permissionsPending as ChatExchange["permissionsPending"] } : {}) };
        }
        if (event === "cancelled") cancelled = { cancelled: true, turnId: String(data.turnId), saved: data.saved as CancelledChatTurn["saved"], stoppedJobs: data.stoppedJobs as string[] | undefined };
        onEvent(frame);
        return event !== "done" && event !== "cancelled";
    }, { signal });
    if (cancelled) return cancelled;
    if (!completed || !exchange) throw new Error("El stream terminó sin confirmar el mensaje. Actualiza el chat antes de reintentar.");
    return exchange;
}

/** One connection; the caller reconnects using the last event id without resending the prompt. */
export async function watchChatEvents(chatId: string, after: string | undefined, onEvent: (event: ChatStreamEvent) => void, signal: AbortSignal, onHeartbeat?: () => void): Promise<boolean> {
    if (isMockMode) return false;
    const response = await fetch(`${chatUrl(chatId)}/events-stream`, { credentials: "include", signal, headers: { Accept: "text/event-stream", ...(after ? { "Last-Event-ID": after } : {}) } });
    if (response.status === 404) {
        const error = await fetchError(response, "No se pudo conectar la actividad del chat");
        if (error instanceof ApiServiceError && error.code === "not_found") return false;
        throw error;
    }
    if (!response.ok) throw await fetchError(response, "No se pudo conectar la actividad del chat");
    onHeartbeat?.();
    await readSse(response, onEvent, { signal, onHeartbeat });
    return true;
}

export async function cancelChatTurn(chatId: string, turnId: string): Promise<components["schemas"]["TurnCancelResult"]> {
    return jsonRequest(`${chatUrl(chatId)}/turns/${encodeURIComponent(turnId)}/cancel`, { method: "POST" });
}
/** Lista fuentes del proyecto del chat, incluido el proyecto oculto de un chat suelto. */
export async function listChatSources(chatId: string, cursor?: string): Promise<{ sources: Source[]; nextCursor?: string }> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockListChatSources(chatId);
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    return jsonRequest(`${chatUrl(chatId)}/sources?${query}`);
}

/** Incorporation, not a later edit/version, determines the displayed source order. */
export function orderChatSources(sources: Source[]): Source[] {
    const group = (source: Source) => source.messageId ? `message:${source.messageId}` : `source:${source.id}`;
    const times = new Map<string, number>();
    for (const source of sources) {
        const stamp = Date.parse(source.addedAt ?? source.createdAt);
        times.set(group(source), Math.max(times.get(group(source)) ?? 0, Number.isFinite(stamp) ? stamp : 0));
    }
    return [...sources].sort((left, right) => {
        const order = (times.get(group(right)) ?? 0) - (times.get(group(left)) ?? 0);
        if (order) return order;
        if (left.messageId && left.messageId === right.messageId) return (left.attachmentIndex ?? Number.MAX_SAFE_INTEGER) - (right.attachmentIndex ?? Number.MAX_SAFE_INTEGER) || left.id.localeCompare(right.id);
        return group(left).localeCompare(group(right));
    });
}

export async function uploadChatSource(chatId: string, file: File, comment?: string): Promise<Source> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockUploadChatSource(chatId, file);
    const form = new FormData();
    form.append("file", file);
    if (comment) form.append("comment", comment);
    return jsonRequest(`${chatUrl(chatId)}/sources`, { method: "POST", body: form });
}

export async function confirmChatIntent(chatId: string, intentId: string, confirmReplaceManual = false): Promise<JobRef | ContextContribution> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockConfirmChatIntent(chatId, intentId);
    return jsonRequest(`${chatUrl(chatId)}/intents/${encodeURIComponent(intentId)}/confirm`, { method: "POST", ...jsonBody({ confirmReplaceManual }) });
}

export async function dismissChatIntent(chatId: string, intentId: string): Promise<void> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockDismissChatIntent(chatId, intentId);
    return jsonRequest(`${chatUrl(chatId)}/intents/${encodeURIComponent(intentId)}/dismiss`, { method: "POST" });
}

export async function answerChatQuestionGroup(chatId: string, groupId: string, answers: { questionId: string; value: unknown }[]): Promise<JobRef> {
    if (isMockMode) return { jobId: `job_mock_question_${groupId}` };
    return jsonRequest(`${chatUrl(chatId)}/question-groups/${encodeURIComponent(groupId)}/answers`, { method: "POST", ...jsonBody({ answers }) });
}

export async function getChatMovePreview(chatId: string, projectId: string): Promise<ChatMovePreview> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockGetChatMovePreview(chatId, projectId);
    return jsonRequest(`${chatUrl(chatId)}/move-preview?${new URLSearchParams({ projectId })}`);
}

export async function moveChat(chatId: string, projectId: string, previewId: string): Promise<Chat> {
    if (isMockMode) return (await import("@/mocks/chat-store")).mockMoveChat(chatId, projectId, previewId);
    return jsonRequest(`${chatUrl(chatId)}/move`, { method: "POST", ...jsonBody({ projectId, previewId }) });
}
