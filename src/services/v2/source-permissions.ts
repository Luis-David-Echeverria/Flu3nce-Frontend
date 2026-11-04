import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";
import { apiError } from "./http";
import type { components } from "@/lib/api-schema";

export type SourcePermission = components["schemas"]["SourcePermission"];
export type SourcePermissionList = components["schemas"]["SourcePermissionList"];
export type Provider = SourcePermission["provider"];

export async function getSourcePermissions(projectId: string, sourceId: string): Promise<SourcePermissionList> {
    if (isMockMode) throw apiError({ code: "permissions_not_available" }, "No disponible en la demo local");
    const { data, error } = await api.GET("/projects/{projectId}/sources/{sourceId}/permissions", { params: { path: { projectId, sourceId } } });
    if (error || !data) throw apiError(error, "No se pudieron cargar los permisos");
    return data;
}

export async function setSourcePermission(projectId: string, sourceId: string, provider: Provider, granted: boolean): Promise<SourcePermissionList> {
    if (isMockMode) throw apiError({ code: "permissions_not_available" }, "No disponible en la demo local");
    const params = { path: { projectId, sourceId, provider } };
    const result = granted
        ? await api.PUT("/projects/{projectId}/sources/{sourceId}/permissions/{provider}", { params })
        : await api.DELETE("/projects/{projectId}/sources/{sourceId}/permissions/{provider}", { params });
    if (result.error) throw apiError(result.error, "No se pudo cambiar el permiso");
    return getSourcePermissions(projectId, sourceId);
}
