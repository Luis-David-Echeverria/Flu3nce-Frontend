import type { Job } from "@/services/v2/types";
import type { LiveActivity } from "./chat-stream-state";

export const isTerminalJob = (status: string) => ["done", "failed", "cancelled"].includes(status);
const stages: Record<string, string> = { leyendo_fuentes: "Leyendo los archivos", ab: "Analizando el proceso", cd: "Detallando el proceso", flujo: "Estructurando los pasos", componiendo: "Preparando el documento", redactando: "Redactando el documento", transcribiendo: "Transcribiendo el audio", preparando: "Preparando el entregable", esperando_servicio: "Esperando al servicio de presentación", publicando: "Guardando el entregable" };
const cancellations: Record<string, string> = { user: "El trabajo se detuvo", user_declined: "No se aplicó el cambio", parent_cancelled: "La solicitud de la que dependía se detuvo", parent_failed: "No se pudo completar el trabajo previo necesario", turn_cancelled: "La solicitud se detuvo", source_removed: "Se retiró el archivo necesario", superseded: "Otra solicitud sustituyó este trabajo", qa_residue: "El trabajo de prueba se cerró", system: "El servidor detuvo el trabajo" };
export const cancelReasonLabel = (reason?: string) => cancellations[reason ?? ""] ?? "El trabajo se detuvo";

export function jobStatusLabel(job: Job): string {
    if (job.status === "queued") return `En cola${job.queuePosition ? ` · posición ${job.queuePosition}` : ""}`;
    if (job.status === "paused") return "Trabajo en pausa";
    if (job.status === "needs_input") return "Esperando tu respuesta";
    if (job.status === "cancelled") return cancelReasonLabel(job.cancelReason);
    if (job.status === "failed") return job.error?.message ?? "No se pudo completar el trabajo";
    if (job.status === "done") return "Trabajo terminado";
    if (job.waitingFor?.kind === "source") return job.waitingFor.name ? `Esperando la lectura de ${job.waitingFor.name}` : "Esperando la lectura de los archivos";
    if (job.waitingFor?.kind === "job") return "Esperando el resultado del trabajo previo";
    if (job.waitingFor?.kind === "external") return "Esperando al servicio externo";
    return stages[job.stage ?? ""] ?? (job.status === "esperando" ? "Esperando para continuar" : "Trabajo en curso");
}

export function activityFromJob(job: Job): LiveActivity {
    const stamp = Date.parse(job.lastHeartbeatAt ?? job.updatedAt ?? job.createdAt ?? "");
    const currentTime = Date.now();
    // The snapshot timestamps measure liveness, not time spent in this stage.
    // Only activity events provide a measured duration; polling must not reset a timer.
    return { id: `snapshot:${job.id}`, jobId: job.id, label: jobStatusLabel(job), kind: "job", state: isTerminalJob(job.status) ? job.status : job.status === "paused" || job.status === "needs_input" ? job.status : "running", ms: 0, durationUnknown: true, updatedAt: Number.isFinite(stamp) ? Math.min(stamp, currentTime) : currentTime, waitingFor: job.waitingFor, expectHeartbeat: ["running", "esperando"].includes(job.status) && !!job.lastHeartbeatAt };
}
