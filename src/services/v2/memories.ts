import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";
import { apiError } from "./http";
import type { components } from "@/lib/api-schema";

export type Memory = components["schemas"]["Memory"];
export type MemoryPage = components["schemas"]["MemoryPage"];
export type MemorySettings = components["schemas"]["MemorySettings"];

export async function listMemories(cursor?: string): Promise<MemoryPage> {
    if (isMockMode) return { memories: [] };
    const { data, error } = await api.GET("/me/memories", { params: { query: { limit: 50, cursor } } });
    if (error || !data) throw apiError(error, "No se pudieron cargar los recuerdos");
    return data;
}

export async function getMemorySettings(): Promise<MemorySettings> {
    if (isMockMode) return { paused: false };
    const { data, error } = await api.GET("/me/memory-settings");
    if (error || !data) throw apiError(error, "No se pudo cargar el ajuste de memoria");
    return data;
}

export async function setMemoryPaused(paused: boolean): Promise<MemorySettings> {
    if (isMockMode) return { paused };
    const { data, error } = await api.PATCH("/me/memory-settings", { body: { paused } });
    if (error || !data) throw apiError(error, "No se pudo cambiar el ajuste de memoria");
    return data;
}

export async function forgetMemory(memoryId: string): Promise<void> {
    if (isMockMode) return;
    const { error } = await api.DELETE("/me/memories/{memoryId}", { params: { path: { memoryId } } });
    if (error) throw apiError(error, "No se pudo olvidar el recuerdo");
}
