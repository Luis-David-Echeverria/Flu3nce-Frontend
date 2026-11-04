// Jobs v2 — el async con estado real. Reemplaza el polling-adivinado del front
// (v1: esperar que aparezca un archivo en la carpeta). Un job puede terminar en
// needs_input con `questions`; el usuario responde y el job reanuda.
import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError } from "./http";
import type { Job } from "./types";

// esperando = el job espera a un servicio externo (ej. Gamma en presentation); sigue vivo.
export type JobStatus = "queued" | "running" | "esperando" | "needs_input" | "paused" | "done" | "failed" | "cancelled";

export async function pauseJob(jobId: string): Promise<{ status: JobStatus; effect: string }> {
    if (isMockMode) return { status: "paused", effect: "paused" };
    const { data, error } = await api.POST("/jobs/{jobId}/pause", { params: { path: { jobId } } });
    if (error || !data) throw apiError(error, "No se pudo pausar el trabajo");
    return data;
}

export async function resumeJob(jobId: string): Promise<{ status: JobStatus; effect: string }> {
    if (isMockMode) return { status: "queued", effect: "resumed" };
    const { data, error } = await api.POST("/jobs/{jobId}/resume", { params: { path: { jobId } } });
    if (error || !data) throw apiError(error, "No se pudo reanudar el trabajo");
    return data;
}

export async function listJobs(opts?: {
    status?: JobStatus;
    projectId?: string;
    limit?: number;
    cursor?: string;
}): Promise<{ jobs: Job[]; nextCursor?: string }> {
    if (isMockMode) return { jobs: (await import("@/mocks/api-store")).mockListJobs(opts?.projectId, opts?.status) };
    const { data, error } = await api.GET("/jobs", {
        params: { query: { status: opts?.status, projectId: opts?.projectId, limit: opts?.limit, cursor: opts?.cursor } },
    });
    if (error || !data) throw apiError(error, "No se pudieron cargar los jobs");
    return { jobs: data.jobs ?? [], nextCursor: data.nextCursor ?? undefined };
}

export async function getJob(jobId: string): Promise<Job> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockGetJob(jobId);
    const { data, error } = await api.GET("/jobs/{jobId}", { params: { path: { jobId } } });
    if (error || !data) throw apiError(error, "No se encontró el job");
    return data;
}

/** Responde las preguntas de un job en needs_input; el job reanuda. */
export async function answerJob(
    jobId: string,
    answers: { questionId: string; value: unknown }[],
): Promise<void> {
    if (isMockMode) return (await import("@/mocks/api-store")).mockAnswerJob(jobId, answers);
    const { error } = await api.POST("/jobs/{jobId}/answers", {
        params: { path: { jobId } },
        body: { answers },
    });
    if (error) throw apiError(error, "No se pudieron enviar las respuestas");
}

/**
 * Cancela un job. El `effect` matiza la respuesta (el 202 la tapa): `cancelled` es
 * inmediata; `requested` se abandona en el próximo punto seguro y puede tardar (hasta
 * ~17s medidos). Si el handler termina antes, el job va a done con cancelRequestedTooLate.
 */
export async function cancelJob(jobId: string): Promise<{ effect?: "cancelled" | "cancelled_external_continues" | "requested" }> {
    if (isMockMode) { (await import("@/mocks/api-store")).mockCancelJob(jobId); return { effect: "cancelled" }; }
    const { data, error } = await api.POST("/jobs/{jobId}/cancel", { params: { path: { jobId } } });
    if (error) throw apiError(error, "No se pudo cancelar el job");
    return data ?? {};
}
