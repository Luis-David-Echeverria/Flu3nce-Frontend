import { ConsultationDeliverableCard, type Card } from "@/components/custom/consultation-deliverable-card";
import { deliverableLabel } from "@/services/v2/labels";
import type { Job } from "@/services/v2/types";
import type { ChatMessage } from "./chat-timeline";
import { ChatActivity, SavedChatActivity } from "./chat-activity";
import { ChatReference } from "./chat-reference";
import type { LiveActivity } from "./chat-stream-state";
import { activityFromJob, cancelReasonLabel, jobStatusLabel } from "./chat-job-state";
import { ChatJobDetails } from "./chat-job-details";

type Props = {
    jobId: string;
    chatId: string;
    messages: ChatMessage[];
    projectId: string;
    canOperate: boolean;
    activities?: LiveActivity[];
    connection?: string;
    stopped?: boolean;
    verifiedJob?: Job;
    showReferences?: boolean;
    renderCards?: boolean;
    busy: boolean;
    onRetry: (intentId: string) => void;
    onOpenDeliverable?: (card: Card, unitId: string) => void;
};

export function ChatJobActivity({ jobId, chatId, messages, projectId, canOperate, activities = [], connection, stopped: locallyStopped, verifiedJob, showReferences = false, renderCards = true, busy, onRetry, onOpenDeliverable }: Props) {
    const statusEvents = messages.filter((item) => item.generationStatus);
    const latestStatus = statusEvents[statusEvents.length - 1]?.generationStatus;
    const failure = [...messages].reverse().find((item) => item.failure)?.failure;
    const referenceMessage = [...messages].reverse().find((item) => item.failure) ?? messages[messages.length - 1];
    const cards = [...new Map(messages.filter((item) => item.deliverableCard).map((item) => [item.deliverableCard!.deliverableId, item])).values()];
    const failedCard = cards.find((item) => item.deliverableCard?.outcome === "failed");
    const expectedTypes = latestStatus?.deliverableTypes ?? messages.find((item) => item.intent?.jobId === jobId)?.intent?.deliverableTypes ?? [];
    const latestSignal = [...messages].reverse().find((item) => item.kind === "generation_status" || item.kind === "deliverable_card" || item.kind === "technical_failure");
    const failed = !!failure || !!failedCard || verifiedJob?.status === "failed" || latestStatus?.phase === "failed";
    const cancelled = !!locallyStopped || verifiedJob?.status === "cancelled" || latestStatus?.phase === "cancelled";
    const partial = verifiedJob?.result?.resultKind === "package_partial" ? verifiedJob.result : undefined;
    const missingResult = verifiedJob?.status === "done" && !verifiedJob.result && !cards.some((item) => item.deliverableCard?.version);
    const finished = !failed && !cancelled && !missingResult && (verifiedJob ? verifiedJob.status === "done" : latestStatus?.phase === "done" ||
        (latestSignal?.kind === "deliverable_card" && cards.length > 0 && (expectedTypes.length === 0 || cards.length >= expectedTypes.length)));
    const active = !finished && !failed && !cancelled && !missingResult;
    const names = expectedTypes.length ? expectedTypes.map((type) => deliverableLabel(type).toLocaleLowerCase("es-MX")).join(" y ") : cards.map((item) => deliverableLabel(item.deliverableCard!.deliverableType).toLocaleLowerCase("es-MX")).join(" y ");
    const heading = failed ? verifiedJob?.error?.message ?? failure?.message ?? failedCard?.deliverableCard?.error?.message ?? "No se pudo completar el trabajo"
        : cancelled ? cancelReasonLabel(verifiedJob?.cancelReason)
        : missingResult ? "El trabajo terminó sin devolver un resultado. Comparte el ID para revisarlo."
        : partial ? `Se completaron ${partial.deliverablesGenerated} de ${partial.deliverablesExpected} entregables`
        : finished ? cards.length && names ? `Ya puedes consultar ${names}` : "Trabajo terminado"
        : verifiedJob && (verifiedJob.status !== "running" || verifiedJob.stage) ? jobStatusLabel(verifiedJob) : latestStatus?.stepLabel ?? "Solicitud confirmada";
    const outcome = failed || missingResult ? "failed" : cancelled ? "cancelled" : partial ? "partial" : finished ? "done" : verifiedJob?.status === "paused" ? "paused" : verifiedJob?.status === "needs_input" ? "needs_user_input" : undefined;
    const group = messages.flatMap((message) => message.parts ?? []).find((part) => part.kind === "activity_group")?.activityGroup;
    const historicalSteps: LiveActivity[] = statusEvents.map((message, index) => ({ id: message.id, label: message.generationStatus!.stepLabel, kind: message.generationStatus!.stage ?? "job", state: index === statusEvents.length - 1 ? outcome ?? "running" : "done", ms: 0, durationUnknown: true, updatedAt: Date.parse(message.createdAt), jobId, expectHeartbeat: message.generationStatus?.phase !== "queued" }));
    const steps: LiveActivity[] = activities.length ? activities.map((item) => outcome && ["running", "pending"].includes(item.state) ? { ...item, state: outcome } : verifiedJob?.status === "queued" ? { ...item, expectHeartbeat: false } : item) : !active && historicalSteps.length ? historicalSteps : verifiedJob ? [{ ...activityFromJob(verifiedJob), ...(!active ? { label: "Resultado del trabajo", durationUnknown: true } : {}) }] : historicalSteps;
    // A technical failure may arrive without any preceding progress message.
    if (!group && !steps.length) steps.push({ id: jobId, jobId, label: heading, kind: "job", state: outcome ?? "running", ms: 0, durationUnknown: true, updatedAt: Date.parse(referenceMessage?.createdAt ?? "") || Date.now() });
    const covered = !renderCards && !active && cards.some((message) => message.parts?.some((part) => part.kind === "activity_group"));
    const details = verifiedJob && (verifiedJob.error || (verifiedJob.result && "inputsUsed" in verifiedJob.result));
    if (covered && !details) return null;

    return <article aria-label={`Actividad de generación: ${heading}`} className="flu-job-activity">
        {!covered ? group ? <SavedChatActivity group={group} force title={heading} outcome={outcome} /> : <ChatActivity items={steps} complete={!active} connection={connection} title={verifiedJob || !active ? heading : undefined} outcome={outcome} /> : null}
        {verifiedJob ? <ChatJobDetails job={verifiedJob} /> : null}
        {renderCards ? cards.map((item) => item.unitId ? <div key={`${item.deliverableCard!.deliverableId}-${item.deliverableCard!.version?.id ?? "pending"}`} className="flu-activity-deliverable"><ConsultationDeliverableCard card={item.deliverableCard!} projectId={projectId} unitId={item.unitId} onOpenPanel={onOpenDeliverable ? () => onOpenDeliverable(item.deliverableCard!, item.unitId!) : undefined} /></div> : null) : null}
        {verifiedJob?.error?.retryable !== false ? cards.filter((item) => item.deliverableCard?.retryIntentId).map((item) => canOperate ? <button key={`retry-${item.deliverableCard!.deliverableId}`} type="button" disabled={busy} onClick={() => onRetry(item.deliverableCard!.retryIntentId!)} className="flu-activity-retry">Reintentar {deliverableLabel(item.deliverableCard!.deliverableType)}</button> : null) : null}
        {verifiedJob?.error?.retryable !== false && failure?.safeAction === "retry" && failure.retryIntentId && canOperate ? <button type="button" disabled={busy} onClick={() => onRetry(failure.retryIntentId!)} className="flu-activity-retry">Confirmar reintento</button> : null}
        {showReferences && referenceMessage ? <ChatReference chatId={chatId} messageId={referenceMessage.id} jobId={jobId} /> : null}
    </article>;
}
