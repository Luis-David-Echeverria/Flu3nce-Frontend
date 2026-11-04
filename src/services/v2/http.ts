// Helpers compartidos de la capa v2. Todas las llamadas tipadas pasan por `api`
// (src/lib/api.ts); acá viven solo utilidades de error y la base para fetch crudo
// (subidas/descargas binarias que no pasan por openapi-fetch).
import { announceSessionExpired } from "@/lib/session-expiry";

/** Base del proxy v2 (ver vite.config.ts: /api/v2 → real|mock según endpoint). */
export const V2 = "/api/v2";

export type ManualVersionConflict = {
    deliverableId: string;
    deliverableType?: string;
    version?: number;
    editedBy?: string;
    editedAt?: string;
};

export class ApiServiceError extends Error {
    constructor(message: string, public readonly code?: string, public readonly detail?: unknown) {
        super(message);
        this.name = "ApiServiceError";
    }
}

/** Conserva el código y detalle del contrato sin filtrar la traza al usuario. */
export function apiError(error: unknown, fallback: string): ApiServiceError {
    const body = error as { code?: unknown; message?: unknown; detail?: unknown } | undefined;
    const message = typeof body?.message === "string" && body.message ? body.message : fallback;
    return new ApiServiceError(message, typeof body?.code === "string" ? body.code : undefined, body?.detail);
}

export function manualVersionConflicts(error: unknown): ManualVersionConflict[] | null {
    if (!(error instanceof ApiServiceError) || error.code !== "manual_version_conflict") return null;
    const detail = error.detail as { conflicts?: unknown } | undefined;
    if (!Array.isArray(detail?.conflicts)) return [];
    return detail.conflicts.flatMap((item): ManualVersionConflict[] => {
        if (!item || typeof item !== "object") return [];
        const conflict = item as Record<string, unknown>;
        if (typeof conflict.deliverableId !== "string") return [];
        return [{
            deliverableId: conflict.deliverableId,
            deliverableType: typeof conflict.deliverableType === "string" ? conflict.deliverableType : undefined,
            version: typeof conflict.version === "number" ? conflict.version : undefined,
            editedBy: typeof conflict.editedBy === "string" ? conflict.editedBy : undefined,
            editedAt: typeof conflict.editedAt === "string" ? conflict.editedAt : undefined,
        }];
    });
}

/** Lee el cuerpo Error {code,message,detail} de una Response fallida de fetch crudo. */
export async function fetchError(res: Response, fallback: string): Promise<Error> {
    if (res.status === 401) announceSessionExpired();
    try {
        const body = await res.json();
        if (body?.message) return apiError(body, fallback);
    } catch {
        /* cuerpo no-JSON */
    }
    return new Error(fallback);
}
