// Capa v2 de proyectos — consume el contrato tipado (src/lib/api.ts).
// Reemplaza al shareService (v1: proyectos por carpeta + rol por /permisos).
// En v2 el proyecto ES la unidad y el `role` viene en la respuesta.
import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError } from "./http";
import type { Project } from "./types";

/** Rol del usuario en el front (traducción del owner/editor/viewer del contrato). */
export type Rol = "propietario" | "editor" | "lector";

/** Mapea el rol del contrato (owner/editor/viewer) al del front (propietario/editor/lector). */
const ROLE_MAP: Record<string, Rol> = { owner: "propietario", editor: "editor", viewer: "lector" };

export interface V2Project {
    id: string;
    name: string;
    description?: string;
    status: "active" | "closed";
    rol: Rol;
    createdBy?: string;
    createdAt?: string;
    updatedAt?: string;
}

function toV2Project(p: Project): V2Project {
    return {
        id: p.id,
        name: p.name,
        description: p.description ?? undefined,
        status: p.status,
        rol: ROLE_MAP[p.role] ?? "lector",
        createdBy: p.createdBy ?? undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt ?? undefined,
    };
}

/** Lista los proyectos del usuario (propios + compartidos). El back ya filtra por membresía. */
export async function listProjects(): Promise<V2Project[]> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockListProjects().map(toV2Project);
    const { data, error } = await api.GET("/projects");
    if (error || !data) throw apiError(error, "No se pudieron cargar los proyectos");
    return (data.projects ?? []).map(toV2Project);
}

/** Página acotada para la navegación de Flu; el directorio puede pedir más. */
export async function listProjectsPage(limit = 10, cursor?: string): Promise<{ projects: V2Project[]; nextCursor?: string }> {
    if (isMockMode) {
        const all = (await import("@/mocks/api-store")).mockListProjects().map(toV2Project);
        const offset = Number(cursor ?? 0) || 0;
        const projects = all.slice(offset, offset + limit);
        return { projects, nextCursor: offset + limit < all.length ? String(offset + limit) : undefined };
    }
    const { data, error } = await api.GET("/projects", { params: { query: { limit, cursor } } });
    if (error || !data) throw apiError(error, "No se pudieron cargar los proyectos");
    return { projects: (data.projects ?? []).map(toV2Project), nextCursor: data.nextCursor ?? undefined };
}

/** Detalle de un proyecto. */
export async function getProject(projectId: string): Promise<V2Project> {
    if (isMockMode) return toV2Project((await import("@/mocks/api-store")).mockGetProject(projectId));
    const { data, error } = await api.GET("/projects/{projectId}", { params: { path: { projectId } } });
    if (error || !data) throw apiError(error, "No se pudo cargar el proyecto");
    return toV2Project(data);
}

/** Crea un proyecto (una sola operación; sin paso de carpeta). */
export async function createProject(name: string, description?: string): Promise<V2Project> {
    if (isMockMode) return toV2Project((await import("@/mocks/api-store")).mockCreateProject(name, description));
    const { data, error } = await api.POST("/projects", { body: { name, description } });
    if (error || !data) throw apiError(error, "No se pudo crear el proyecto");
    return toV2Project(data);
}

/** Actualiza nombre/descripción/estado. */
export async function updateProject(
    projectId: string,
    patch: { name?: string; description?: string; status?: "active" | "closed" },
): Promise<V2Project> {
    if (isMockMode) return toV2Project((await import("@/mocks/api-store")).mockUpdateProject(projectId, patch));
    const { data, error } = await api.PATCH("/projects/{projectId}", {
        params: { path: { projectId } },
        body: patch,
    });
    if (error || !data) throw apiError(error, "No se pudo actualizar el proyecto");
    return toV2Project(data);
}

/** Renombra el proyecto (atajo de updateProject). */
export const renameProject = (projectId: string, name: string) => updateProject(projectId, { name });

/** Cierra un proyecto. v2 no tiene borrado físico: los engagements se cierran (estado). */
export async function closeProject(projectId: string): Promise<void> {
    await updateProject(projectId, { status: "closed" });
}
