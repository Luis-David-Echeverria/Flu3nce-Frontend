// Miembros v2 — reemplaza a share-service (v1: permisos por carpeta).
// En v2 el proyecto ES la unidad de permisos; el rol viene en cada Member.
import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError } from "./http";
import type { Member, Role } from "./types";

export async function listMembers(projectId: string): Promise<Member[]> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockListMembers();
    const { data, error } = await api.GET("/projects/{projectId}/members", {
        params: { path: { projectId } },
    });
    if (error || !data) throw apiError(error, "No se pudieron cargar los miembros");
    return data.members ?? [];
}

export interface MemberCandidate { userId: string; email?: string; name?: string; projects?: number }

/** El email invitado resuelve a varias cuentas: el back devuelve 409 con los candidatos. */
export class MemberConflictError extends Error {
    readonly candidates: MemberCandidate[];
    constructor(message: string, candidates: MemberCandidate[]) {
        super(message);
        this.name = "MemberConflictError";
        this.candidates = candidates;
    }
}

// Extrae los candidatos del `detail` del 409 (forma no declarada en el contrato → lectura
// defensiva de las claves probables).
function candidatesFrom(error: unknown): MemberCandidate[] {
    const detail = (error as { detail?: unknown })?.detail as Record<string, unknown> | undefined;
    const raw = detail && (detail.candidates ?? detail.users ?? detail.accounts ?? detail.matches);
    if (!Array.isArray(raw)) return [];
    const out: MemberCandidate[] = [];
    for (const c of raw) {
        const o = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
        const userId = o ? o.userId ?? o.id : typeof c === "string" ? c : undefined;
        if (typeof userId !== "string") continue;
        out.push({
            userId,
            email: typeof o?.email === "string" ? o.email : undefined,
            name: typeof o?.name === "string" ? o.name : undefined,
            projects: typeof o?.projects === "number" ? o.projects : typeof o?.projectCount === "number" ? o.projectCount : undefined,
        });
    }
    return out;
}

/** Agrega/invita un miembro por id o email (solo owner). */
export async function addMember(projectId: string, userId: string, role: Role): Promise<Member> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockAddMember(userId, role);
    const { data, error, response } = await api.POST("/projects/{projectId}/members", {
        params: { path: { projectId } },
        body: { userId, role },
    });
    if (error || !data) {
        if (response?.status === 409) {
            const candidates = candidatesFrom(error);
            if (candidates.length) throw new MemberConflictError("Ese correo resuelve a varias cuentas. Elige cuál invitar.", candidates);
        }
        throw apiError(error, "No se pudo agregar el miembro");
    }
    return data;
}

export async function updateMemberRole(projectId: string, userId: string, role: Role): Promise<Member> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockUpdateMember(userId, role);
    const { data, error } = await api.PATCH("/projects/{projectId}/members/{userId}", {
        params: { path: { projectId, userId } },
        body: { role },
    });
    if (error || !data) throw apiError(error, "No se pudo cambiar el rol");
    return data;
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
    if (isMockMode) { (await import("@/mocks/api-store")).mockRemoveMember(userId); return; }
    const { error } = await api.DELETE("/projects/{projectId}/members/{userId}", {
        params: { path: { projectId, userId } },
    });
    if (error) throw apiError(error, "No se pudo quitar el miembro");
}
