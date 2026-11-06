import { Suspense, type ComponentProps } from "react";
import { ChatMarkdown } from "@/components/custom/chat-markdown";
import { ChatTable } from "@/components/custom/chat-table";
import { ConsultationDeliverableCard, type Card } from "@/components/custom/consultation-deliverable-card";
import { ConsultationQuestions } from "@/components/custom/consultation-questions";
import { ReadableQuestionPrompt } from "@/components/custom/readable-question-prompt";
import type { components } from "@/lib/api-schema";
import { deliverableLabel } from "@/services/v2/labels";
import type { Job, PermissionPending, Source } from "@/services/v2/types";
import { SavedChainActivity, SavedChatActivity } from "./chat-activity";
import { ChatDeliverableTile } from "./chat-deliverable-tile";
import { ChatJobDetails } from "./chat-job-details";
import { ChatCopyMessage, messageCopyText } from "./chat-copy-message";
import { ChatPermissions } from "./chat-permissions";
import { ChatReference } from "./chat-reference";
import { SourceTypeIcon } from "./flu-source-preview";
import { intentDestination, messageDate, visibleMessageText, type ChatIntent, type ChatMessage } from "./flu-chats-helpers";

export type ExchangeMetadata = { requestId?: string; failure?: components["schemas"]["TurnFailure"]; permissionsPending?: PermissionPending[] };

type Props = {
    item: ChatMessage;
    chatId: string;
    projectId: string;
    /** El mensaje es posterior al último del usuario: sus acciones siguen vigentes. */
    actionsCurrent: boolean;
    metadata?: ExchangeMetadata;
    explanation?: string;
    sources: Source[];
    freeMessagesEnabled: boolean;
    canOperate: boolean;
    canRevise: boolean;
    busy: boolean;
    verifiedJob?: Job;
    showReferences: boolean;
    onOpenSource: (source: Source) => void;
    onOpenDeliverable: (card: Card, unitId: string) => void;
    onOpenPartDeliverable: (card: Card) => void;
    onSendText: (text: string) => void;
    onConfirm: (intentId: string) => void;
    onDismiss: (intentId: string) => void;
    onAnswerQuestionGroup: (groupId: string, answers: Parameters<ComponentProps<typeof ConsultationQuestions>["onAnswer"]>[0]) => Promise<void>;
};

/** Un mensaje del historial: texto, partes, tarjetas, propuestas y su actividad guardada. */
export function FluChatMessage({ item, chatId, projectId, actionsCurrent, metadata, explanation, sources, freeMessagesEnabled, canOperate, canRevise, busy, verifiedJob, showReferences, onOpenSource, onOpenDeliverable, onOpenPartDeliverable, onSendText, onConfirm, onDismiss, onAnswerQuestionGroup }: Props) {
        const activityGroup = !item.chainBlock ? item.parts?.find((part) => part.kind === "activity_group")?.activityGroup : undefined;
                const displayText = item.intent?.state === "pending" && !actionsCurrent ? "Esta propuesta ya venció." : visibleMessageText(item);
        const intent = item.intent as ChatIntent | undefined;
    const copyText = item.role === "flu" && !item.intent ? messageCopyText(item, displayText, explanation) : "";
        const revision = intent?.revisionProposal;
        const revises = intent?.intentKind === "revise_deliverable";
        const saves = intent?.intentKind === "save_context";
        const supported = !!intent && [undefined, "generate", "save_context", "revise_deliverable"].includes(intent.intentKind) && (!revises || canRevise);
        const ready = saves ? !!intent?.contextProposal?.text : revises
            ? !!intent?.unitId && !!intent?.deliverableId && !!revision && (revision.executionScope === "targeted_change" ? !!revision.preview?.trim() : revision.executionScope === "full_regeneration" && !revision.preview)
            : !!intent && (intent.destinations?.length ? intent.destinations.every((destination) => destination.deliverableTypes.length > 0 && !!(destination.unitId || destination.newUnit)) : !!(intent.unitId || intent.newUnit));
        return <article aria-label={`${item.role === "user" ? "Tu mensaje" : item.role === "system" ? "Mensaje del sistema" : "Respuesta de Flu3nce"}, ${messageDate(item.createdAt)}`} className={`flu-message min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "ml-auto flu-user" : "flu-assistant"}`}>
            {item.parts?.some((part) => part.kind !== "activity_group") ? <div className="flu-message-parts">{item.parts.map((part, index) => {
                if (part.kind === "text" && part.text) return <Suspense key={index} fallback={<p className="whitespace-pre-wrap break-words">{part.text}</p>}><ReadableQuestionPrompt prompt={part.text} /></Suspense>;
                if (part.kind === "table" && part.table) return <div key={index}><ChatTable className="flu-message-part-table"><thead><tr>{part.table.columns.map((column, cell) => <th key={cell} scope="col">{column}</th>)}</tr></thead><tbody>{part.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{part.table!.columns.map((_, cell) => <td key={cell}>{row[cell] ?? ""}</td>)}</tr>)}</tbody></ChatTable>{part.table.calculated ? <small>Los valores marcados «calculado» fueron calculados por Flu3nce.</small> : null}</div>;
                if (part.kind === "deliverable_card" && part.deliverableCard) return <ChatDeliverableTile key={index} card={part.deliverableCard} onOpen={() => onOpenPartDeliverable(part.deliverableCard!)} />;
                if (part.kind === "question" && part.clarification) return <Suspense key={index} fallback={<p>{part.clarification.prompt}</p>}><ReadableQuestionPrompt prompt={part.clarification.prompt} /></Suspense>;
                return null;
            })}</div> : <Suspense fallback={<p className="whitespace-pre-wrap break-words">{displayText}</p>}><ReadableQuestionPrompt prompt={displayText} /></Suspense>}
            {explanation && explanation !== displayText ? <ChatMarkdown text={explanation} /> : null}
            {item.role === "flu" && item.modelUsed ? <small className="flu-message-model">Modelo usado: {item.modelUsed}</small> : null}
            {item.refs?.sourceIds?.length ? <div className="flu-message-sources">{item.refs.sourceIds.map((sourceId) => { const source = sources.find((candidate) => candidate.id === sourceId); return source ? <button key={sourceId} type="button" onClick={() => onOpenSource(source)} className="flu-message-source-card" aria-label={`Ver archivo original ${source.name}`}><SourceTypeIcon source={source} /><span>{source.name}</span><small>{source.status === "processing" ? "Procesando para Flu3nce · original disponible" : source.status === "failed" ? "No se pudo leer para Flu3nce · original disponible" : "Ver archivo original"}</small></button> : null; })}</div> : null}
            {item.refs?.sourceIds?.length && item.failure ? <p className="flu-source-extraction-note">Flu3nce aún no puede usar el contenido de este archivo. Puedes abrir el original desde la tarjeta.</p> : null}
            {item.generationStatus ? <p className="flu-chat-status mt-2 rounded-lg bg-[color:var(--fl-primary-subtle)] px-3 py-2 text-xs text-[color:var(--fl-link)]">{item.generationStatus.stepLabel}</p> : null}
            {actionsCurrent && item.clarification?.suggestions?.length ? <div className="flu-chat-suggestions mt-3 flex flex-wrap gap-2">{item.clarification.suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy || !canOperate || !freeMessagesEnabled} onClick={() => onSendText(suggestion)} className="rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fl-link)] disabled:opacity-50">{suggestion}</button>)}</div> : null}
            {item.answers?.answers.length ? <ul className="flu-chat-answers mt-2 space-y-1 rounded-lg bg-[color:var(--fl-surface-2)] p-3 text-xs text-[color:var(--fl-text-3)]">{item.answers.answers.map((answer) => <li key={answer.questionId}>{answer.display ?? String(answer.value)}</li>)}</ul> : null}
            {actionsCurrent && item.questionGroup?.state === "open" && canOperate ? <ConsultationQuestions group={item.questionGroup} projectId={projectId} onAnswer={(answers) => onAnswerQuestionGroup(item.questionGroup!.id, answers)} /> : null}
            {item.deliverableCard && !item.parts?.some((part) => part.kind === "deliverable_card") ? item.chainBlock ? <ChatDeliverableTile card={item.deliverableCard} onOpen={() => onOpenPartDeliverable(item.deliverableCard!)} /> : (item as ChatMessage).unitId ? <ConsultationDeliverableCard card={item.deliverableCard} projectId={projectId} unitId={(item as ChatMessage).unitId!} onOpenPanel={() => onOpenDeliverable(item.deliverableCard!, (item as ChatMessage).unitId!)} /> : <ChatDeliverableTile card={item.deliverableCard} onOpen={() => onOpenPartDeliverable(item.deliverableCard!)} /> : null}
            {metadata?.failure && !item.failure && metadata.failure.message !== displayText ? <p className="flu-chat-failure" role="alert">{metadata.failure.message}</p> : null}
            {metadata?.permissionsPending?.length || metadata?.failure?.action?.kind === "grant_permission" ? <ChatPermissions pending={metadata.permissionsPending} action={metadata.failure?.action} projectId={projectId} canWrite={canOperate} /> : null}
            {verifiedJob ? <ChatJobDetails job={verifiedJob} projectId={projectId} canWrite={canOperate} /> : null}
            {item.failure && !item.refs?.sourceIds?.length ? <div className="flu-chat-failure mt-2 rounded-lg border border-[color:var(--fl-error-border)] bg-[color:var(--fl-error-bg)] px-3 py-2 text-xs text-[color:var(--fl-error-text)]"><p>{item.failure.message}</p>{actionsCurrent && item.failure.safeAction === "retry" && item.failure.retryIntentId && canOperate ? <button type="button" disabled={busy} onClick={() => onConfirm(item.failure!.retryIntentId!)} className="mt-2 rounded-lg border border-[color:var(--fl-error-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 font-semibold">Confirmar reintento</button> : null}</div> : null}
            {actionsCurrent && intent?.state === "pending" ? <div className="flu-chat-proposal mt-3 rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] p-3 text-xs">
                <p className="font-bold text-[color:var(--fl-text)]">Acción propuesta · todavía no ejecutada</p>
                <p className="mt-1">{intentDestination(intent)}</p>
                {intent.destinations?.length ? <ul className="mt-2 space-y-1">{intent.destinations.map((destination, index) => <li key={`${destination.unitId ?? destination.newUnit?.name ?? "destino"}-${index}`} className="rounded-lg bg-[color:var(--fl-bg)] px-2 py-1.5">{destination.deliverableTypes.map(deliverableLabel).join(", ")} · {destination.newUnit?.name ?? "Destino existente"}</li>)}</ul> : intent.deliverableTypes.length ? <p className="mt-1">Entregables: {intent.deliverableTypes.map(deliverableLabel).join(", ")}</p> : null}
                {intent.deliverableId ? <p className="mt-1">Solo se cambiará el entregable seleccionado.</p> : null}
                {saves && intent.contextProposal ? <p className="mt-2 rounded-lg bg-[color:var(--fl-bg)] p-2 whitespace-pre-wrap">Dato a guardar: {intent.contextProposal.text}</p> : null}
                {revision ? <div className="mt-2 rounded-lg bg-[color:var(--fl-bg)] p-2"><p>{revision.executionScope === "targeted_change" ? "Cambio puntual" : "Regeneración completa"}: {revision.changeSummary}</p>{revision.executionScope === "targeted_change" && revision.preview ? <pre className="mt-2 whitespace-pre-wrap break-words font-sans">Vista previa exacta: {revision.preview}</pre> : null}</div> : null}
                {!supported ? <p className="mt-2 text-[color:var(--fl-warning-text)]">Esta versión aún no puede confirmar este tipo de intención.</p> : !ready ? <p className="mt-2 text-[color:var(--fl-error-text)]">La propuesta no identifica todo lo necesario para confirmarla de forma segura.</p> : null}
                {supported && canOperate ? <div className="mt-3 flex gap-2"><button type="button" disabled={busy || !ready} onClick={() => onConfirm(intent.id)} className="rounded-lg bg-[color:var(--fl-primary)] px-3 py-2 font-semibold text-white disabled:opacity-50">{saves ? "Guardar dato" : revises ? "Confirmar revisión" : "Confirmar generación"}</button><button type="button" disabled={busy} onClick={() => onDismiss(intent.id)} className="rounded-lg border border-[color:var(--fl-border)] px-3 py-2">Descartar</button></div> : null}
            </div> : null}
            {activityGroup ? <SavedChatActivity group={activityGroup} title={activityGroup.jobId && item.deliverableCard?.version ? `Ya puedes consultar ${deliverableLabel(item.deliverableCard.deliverableType).toLocaleLowerCase("es-MX")}` : undefined} /> : null}
            {item.chainBlock?.final ? <SavedChainActivity block={item.chainBlock} /> : null}
                {copyText ? <ChatCopyMessage text={copyText} /> : null}
                {showReferences ? <ChatReference chatId={chatId} messageId={item.id} requestId={item.chainBlock?.requestId ?? metadata?.requestId} /> : null}
        </article>;
}
