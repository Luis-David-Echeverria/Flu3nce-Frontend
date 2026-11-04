import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";
import { apiError } from "./http";
import type { components } from "@/lib/api-schema";

export type LibrarySource = components["schemas"]["LibrarySource"];
export type LibrarySourcePage = components["schemas"]["LibrarySourcePage"];

export async function listChatLibrary(chatId: string, cursor?: string): Promise<LibrarySourcePage> {
    if (isMockMode) return { sources: [] };
    const { data, error } = await api.GET("/chats/{chatId}/library", {
        params: { path: { chatId }, query: { limit: 50, cursor } },
    });
    if (error || !data) throw apiError(error, "No se pudo cargar la biblioteca");
    return data;
}

export async function attachLibrarySource(chatId: string, sourceId: string): Promise<void> {
    if (isMockMode) return;
    const { error } = await api.PUT("/chats/{chatId}/library/{sourceId}", {
        params: { path: { chatId, sourceId } },
    });
    if (error) throw apiError(error, "No se pudo adjuntar la fuente");
}

export async function detachLibrarySource(chatId: string, sourceId: string): Promise<void> {
    if (isMockMode) return;
    const { error } = await api.DELETE("/chats/{chatId}/library/{sourceId}", {
        params: { path: { chatId, sourceId } },
    });
    if (error) throw apiError(error, "No se pudo quitar la fuente del chat");
}
