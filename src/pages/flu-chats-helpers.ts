import type { Card } from "@/components/custom/consultation-deliverable-card";
import { ApiServiceError } from "@/services/v2/http";
import { deliverableLabel } from "@/services/v2/labels";
import type { ConsultationMessage, GenerationIntent } from "@/services/v2/types";

export type ChatMessage = ConsultationMessage & { unitId?: string };
export type ChatIntent = GenerationIntent & {
    unitId?: string;
    newUnit?: { name: string; kind: string };
    deliverableId?: string;
};

export class ChatUserError extends Error {}

export function messageDate(value: string) {
    return new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

export function cardTitle(card: Card): string {
    return "title" in card && typeof card.title === "string" && card.title.trim() ? card.title : deliverableLabel(card.deliverableType);
}

export function itemCount(count: number, singular: string, plural: string): string { return `${count} ${count === 1 ? singular : plural}`; }

export function intentDestination(intent: ChatIntent): string {
    if (intent.intentKind === "save_context") return "Dato que quedará registrado con su procedencia";
    if (intent.destinations?.length) return `${intent.destinations.length} destinos propuestos para ${intent.destinations.reduce((total, destination) => total + destination.deliverableTypes.length, 0)} entregables`;
    if (intent.newUnit) return `Nombre propuesto: ${intent.newUnit.name}`;
    if (intent.deliverableId) return "Cambio sobre el entregable indicado";
    return "Acción sobre un entregable existente";
}

export function visibleMessageText(item: ChatMessage): string {
    const intent = item.intent as ChatIntent | undefined;
    if (item.refs?.sourceIds?.length && item.text.startsWith("Archivo añadido a este chat.") && item.text.includes("No pude leer")) return "Archivo añadido a este chat.";
    if (item.kind !== "intent_to_confirm" || !intent) return item.text;
    const types = (intent.destinations?.flatMap((destination) => destination.deliverableTypes) ?? intent.deliverableTypes)
        .map((type) => deliverableLabel(type).toLocaleLowerCase("es-MX")).join(" y ");
    if (intent.state === "dismissed") return "Propuesta descartada.";
    if (intent.state === "confirmed") return "Propuesta confirmada.";
    if (intent.state === "expired") return "Esta propuesta ya venció.";
    if (intent.state === "pending") return confirmationReason(intent) ? "Para continuar falta tu confirmación." : "Esta tarea no se ejecutó: quedó esperando una confirmación que ya no se usa.";
    if (intent.intentKind === "save_context") return "Te propongo guardar este dato para tenerlo en cuenta después.";
    if (intent.intentKind === "revise_deliverable") return "Te propongo un cambio al entregable.";
    if (intent.intentKind === "generate" || !intent.intentKind) return `Te propongo preparar ${types || "el entregable"}.`;
    return item.text;
}

export function chatErrorForUser(error: unknown, fallback: string): string {
    if (error instanceof ChatUserError) return error.message;
    if (!(error instanceof ApiServiceError)) return fallback;
    switch (error.code) {
        case "source_duplicate": return "Este archivo ya está entre las fuentes. Revisa la lista antes de volver a subirlo.";
        case "preview_changed": return "El contenido que se movería cambió. Revisa una vista previa nueva antes de confirmar.";
        case "jobs_running": return "Hay una generación en curso. Podrás mover el chat cuando termine.";
        case "intent_not_pending": return "Esta propuesta ya no está pendiente. Actualiza el chat para ver su estado actual.";
        case "contribution_not_active": return "Ese dato ya no está vigente. Revisa el contexto y solicita una propuesta nueva.";
        case "deliverable_busy": return "El entregable sigue generándose. La propuesta permanece pendiente; inténtalo cuando termine.";
        case "move_name_conflict": return "Ya existe un archivo con ese nombre en el proyecto destino. Resuelve el conflicto antes de mover el chat.";
        case "question_group_closed": return "Esa ronda ya se cerró. Actualiza el chat para ver las preguntas vigentes.";
        case "consultation_disabled": return "El chat todavía no está habilitado para esta cuenta.";
        case "provider_unavailable": return "El servicio de conversación no está disponible en este momento. Inténtalo de nuevo más tarde.";
        case "source_not_permitted": return error.message?.trim() || "Un archivo no se pudo enviar al proveedor que hace este trabajo.";
        case "model_not_available": return "El modelo elegido dejó de estar disponible. Selecciona uno de los modelos habilitados y vuelve a pedirlo; no se cambió de modelo a escondidas.";
        case "job_not_pausable": return "Este trabajo ya no se puede pausar. Actualiza su estado.";
        case "job_not_resumable": return "Este trabajo ya no se puede reanudar. Actualiza su estado.";
        case "job_control_via_parent": return "Controla el paquete completo desde su trabajo principal.";
        case "internal_error": return fallback;
        default: return error.message?.trim() || fallback;
    }
}

const CONFIRMATION_REASONS: Record<string, string> = {
    external_cost: "Usa un servicio externo con coste, como Gamma para presentaciones.",
    manual_version_conflict: "Sustituiría una versión editada a mano.",
    affects_others: "Afecta a otras personas, por ejemplo al compartir o invitar.",
    provider_permission: "Enviaría un archivo a un proveedor que no tiene permiso para él.",
    irreversible_delete: "Borraría algo que no se puede recuperar.",
    scope_expansion: "Haría más de lo que pediste.",
};

/**
 * Por qué una acción SÍ necesita confirmación, o `null` si no la necesita. Lo pedido se
 * ejecuta sin propuesta; solo esperan los motivos del contrato (`reason`) y el freno de
 * Gamma, que el backend mantiene para las presentaciones aunque todavía no envíe el motivo.
 */
export function confirmationReason(intent: ChatIntent): string | null {
    if (intent.reason) return CONFIRMATION_REASONS[intent.reason] ?? "Esta acción necesita tu confirmación antes de continuar.";
    const types = [...(intent.deliverableTypes ?? []), ...(intent.destinations?.flatMap((destination) => destination.deliverableTypes) ?? [])];
    if (intent.intentKind !== "save_context" && types.includes("presentation")) return CONFIRMATION_REASONS.external_cost;
    return null;
}
