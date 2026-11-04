import { api } from "@/lib/api";
import type { components } from "@/lib/api-schema";
import { isMockMode } from "@/config/api-mode";
import { apiError } from "./http";

export type ModelList = components["schemas"]["ModelList"];

/** A 404 means the selector is off for this account; never send a model then. */
export async function listAvailableModels(): Promise<ModelList | null> {
    if (isMockMode) return null;
    const { data, error, response } = await api.GET("/models");
    if (response.status === 404) return null;
    if (error || !data) throw apiError(error, "No se pudo consultar la lista de modelos");
    return data;
}
