/** Recorrido visual local de /chats. Nunca se importa para ejecutar en producción. */
import { mockAdvanceDeliverableVersion, mockCreateDeliverable, mockGetChatPreviewNote, mockGetDeliverable, mockListDeliverables, mockMoveChatDeliverables, mockSetChatPreviewNote } from "./api-store";
import type { Chat, ChatMovePreview, ChatSession } from "@/services/v2/chats";
import type { ConsultationMessage, ContextContribution, DeliverableType, JobRef, Source } from "@/services/v2/types";

type MockMessage = ChatSession["messages"][number];
type MockIntent = NonNullable<MockMessage["intent"]>;
type ChatRecord = { chat: Chat; messages: MockMessage[]; sources: Source[]; facts: ContextContribution[]; awaiting?: DeliverableType };
const DEMO_PROJECT = "prj_mock_reclutamiento";
export const MOCK_TOUR_CHAT_ID = "chat_mock_tour";
export const MOCK_TOUR_PROJECT_ID = DEMO_PROJECT;
const records = new Map<string, ChatRecord>();
const uploadedSourceBlobs = new Map<string, Blob>();
let serial = 0;
const next = (prefix: string) => `${prefix}_mock_${++serial}`;
const now = () => new Date().toISOString();
const clone = <T,>(value: T): T => structuredClone(value);
const must = (id: string): ChatRecord => {
    const record = records.get(id);
    if (!record) throw new Error("No se encontró el chat de demostración.");
    return record;
};
const add = (record: ChatRecord, role: MockMessage["role"], kind: MockMessage["kind"], text: string, extra: Partial<MockMessage> = {}) => {
    const message: MockMessage = { id: next("message"), createdAt: now(), role, kind, text, ...extra };
    record.messages.push(message);
    record.chat.updatedAt = message.createdAt;
    return message;
};
const typeLabel: Partial<Record<DeliverableType, string>> = {
    policy_draft: "borrador de política", presentation: "presentación", diagram_as_is: "diagrama",
    diagnostic: "diagnóstico", understanding: "entendimiento", policy_analysis: "análisis de política",
};
const unitKind = (type: DeliverableType) => type === "policy_draft" || type === "policy_analysis" ? "policy" : type === "presentation" ? "presentation" : "process";
const lastCard = (record: ChatRecord) => [...record.messages].reverse().find((message) => message.deliverableCard)?.deliverableCard;
const lastUnit = (record: ChatRecord) => [...record.messages].reverse().find((message) => message.deliverableCard)?.unitId;
const titleIn = (text: string) => text.match(/[«"“]([^»"”]+)[»"”]/)?.[1];

function offer(record: ChatRecord, type: DeliverableType, request: string): ConsultationMessage {
    const label = typeLabel[type] ?? "entregable";
    const topic = titleIn(request) ?? request.replace(/^(?:haz|crea|prepara|quiero|necesito|una?|el|la|de|sobre|ayúdame a elaborar)\s+/gi, "").trim();
    const name = topic.length > 5 && topic.length < 85 ? topic : label[0].toUpperCase() + label.slice(1);
    const intent: MockIntent = {
        id: next("intent"), intentKind: "generate", target: "deliverable", deliverableTypes: [type], state: "pending",
        rationale: "La conversación ya contiene un objetivo y alcance de ejemplo.",
        newUnit: { name, kind: unitKind(type) },
    };
    return add(record, "flu", "intent_to_confirm", `Puedo preparar el ${label} con lo conversado. Revisa la propuesta antes de confirmar.`, { intent });
}

function seed() {
    const stamp = now();
    const tour: ChatRecord = {
        chat: { id: MOCK_TOUR_CHAT_ID, projectId: DEMO_PROJECT, title: "Recorrido visual · Flu3nce", shared: false, unassigned: false, access: "owner", createdAt: stamp, updatedAt: stamp },
        messages: [], sources: [{ id: "source_mock_tour", projectId: DEMO_PROJECT, name: "Proceso_de_compras_ejemplo.pdf", mime: "application/pdf", size: 18240, kind: "document", status: "ready", currentVersion: 1, createdAt: stamp }], facts: [],
    };
    add(tour, "flu", "text", "Esta es una **demostración local** con información inventada. Puedes abrir entregables, revisar una propuesta, adjuntar un archivo o escribir libremente. Ninguna acción llama al modelo ni al backend real.");
    add(tour, "user", "text", "Necesito una política y un diagrama del proceso de compras menores.");
    add(tour, "flu", "text", "Trabajemos con un caso de ejemplo: compras menores a $10,000, solicitud del área y aprobación de Finanzas. Preparé una política, un diagrama y una presentación para que explores sus vistas.");
    const samples: { type: DeliverableType; unitId: string; title: string }[] = [
        { type: "policy_draft", unitId: "unit_mock_policy", title: "Política de compras menores" },
        { type: "diagram_as_is", unitId: "unit_mock_process", title: "Proceso de compras menores" },
        { type: "presentation", unitId: "unit_mock_presentation", title: "Resumen ejecutivo de compras" },
    ];
    for (const sample of samples) {
        const deliverable = mockGetDeliverable(DEMO_PROJECT, `dlv_mock_${sample.type}`);
        mockSetChatPreviewNote(deliverable.id, deliverable.currentVersion, sample.title);
        const jobId = next("job");
        add(tour, "flu", "generation_status", `Preparando ${sample.title}`, { unitId: sample.unitId, refs: { jobId }, generationStatus: { jobId, target: "deliverable", deliverableTypes: [sample.type], phase: "done", stepLabel: `${sample.title} listo` } });
        add(tour, "flu", "deliverable_card", `${sample.title} disponible`, { unitId: sample.unitId, refs: { jobId, deliverableIds: [deliverable.id] }, deliverableCard: { deliverableId: deliverable.id, deliverableType: sample.type, outcome: "generated", status: "ready", version: { id: `ver_mock_${deliverable.currentVersion}`, number: deliverable.currentVersion }, summary: `Ejemplo visual de ${sample.title.toLowerCase()}.`, title: sample.title } as NonNullable<MockMessage["deliverableCard"]> & { title: string } });
    }
    add(tour, "user", "text", "Corrige la política: la aprobación de compras menores a $10,000 debe ser de Dirección.");
    const current = mockGetDeliverable(DEMO_PROJECT, "dlv_mock_policy_draft");
    const revision: MockIntent = {
        id: next("intent"), intentKind: "revise_deliverable", target: "deliverable", deliverableTypes: ["policy_draft"], state: "pending",
        unitId: current.unitId, deliverableId: current.id,
        revisionProposal: { deliverableId: current.id, baseVersion: { deliverableId: current.id, versionId: `ver_mock_${current.currentVersion}`, number: current.currentVersion }, request: "Cambiar la aprobación a Dirección para compras menores a $10,000", executionScope: "full_regeneration", changeSummary: "Se regenerará el borrador completo con esta corrección; la versión anterior quedará en el historial." },
    };
    add(tour, "flu", "intent_to_confirm", "Revisaré la política existente con esa corrección. La versión anterior se conservará.", { intent: revision });
    records.set(tour.chat.id, tour);

    const guided: ChatRecord = { chat: { id: "chat_mock_guided", projectId: DEMO_PROJECT, title: "Desde cero · propuesta y progreso", shared: false, unassigned: false, access: "owner", createdAt: stamp, updatedAt: stamp }, messages: [], sources: [], facts: [] };
    add(guided, "user", "text", "Quiero una política de compras menores: aplica a todas las áreas, hasta $10,000 y requiere aprobación de Dirección.");
    add(guided, "flu", "text", "Entendido. El objetivo, el alcance y la regla de aprobación ya están claros. Podemos preparar un primer borrador y ajustarlo después.");
    offer(guided, "policy_draft", "Política de compras menores");
    records.set(guided.chat.id, guided);
}
seed();

export const mockListChats = (scope: { projectId: string } | { unassigned: true }): { chats: Chat[] } => ({
    chats: [...records.values()].filter((item) => "projectId" in scope ? !item.chat.unassigned && item.chat.projectId === scope.projectId : item.chat.unassigned).map((item) => clone(item.chat)).reverse(),
});
export const mockCreateChat = (title: string, projectId?: string): Chat => {
    const id = next("chat"); const stamp = now();
    const chat: Chat = { id, projectId: projectId ?? `prj_mock_personal_${id}`, title: title || "Nueva conversación", shared: false, unassigned: !projectId, access: "owner", createdAt: stamp, updatedAt: stamp };
    records.set(id, { chat, messages: [], sources: [], facts: [] });
    return clone(chat);
};
export const mockUpdateChat = (id: string, patch: { title?: string; shared?: boolean }): Chat => {
    const record = must(id);
    if (patch.title !== undefined) record.chat.title = patch.title;
    if (patch.shared !== undefined && !record.chat.unassigned) record.chat.shared = patch.shared;
    record.chat.updatedAt = now();
    return clone(record.chat);
};
export const mockGetChat = (id: string, cursor?: string, since?: string): ChatSession => {
    const record = must(id);
    const index = since ? record.messages.findIndex((message) => message.id === since) : -1;
    const chronological = since ? record.messages.slice(index + 1) : cursor ? [] : record.messages;
    return clone({ chat: record.chat, messages: [...chronological].reverse(), pendingIntentIds: record.messages.filter((item) => item.intent?.state === "pending").map((item) => item.intent!.id), freeMessagesEnabled: true, revisionIntentsEnabled: true });
};
export const mockSendChatMessage = (id: string, text: string, clientMessageId: string): { userMessage: ConsultationMessage; reply: ConsultationMessage } => {
    const record = must(id);
    const existing = record.messages.find((message) => message.id === clientMessageId);
    if (existing) return { userMessage: clone(existing), reply: clone(record.messages[record.messages.indexOf(existing) + 1]) };
    for (const message of record.messages) if (message.intent?.state === "pending") message.intent.state = "expired";
    const userMessage = add(record, "user", "text", text);
    userMessage.id = clientMessageId;
    const lower = text.toLocaleLowerCase("es-MX");
    let reply: ConsultationMessage;
    const previous = lastCard(record);
    if (/(corrige|cambia|modifica|renombra|ajusta|título)/i.test(lower) && previous) {
        const unitId = lastUnit(record)!;
        const current = mockGetDeliverable(record.chat.projectId, previous.deliverableId);
        const targeted = previous.deliverableType === "diagram_as_is";
        const intent: MockIntent = { id: next("intent"), intentKind: "revise_deliverable", target: "deliverable", deliverableTypes: [previous.deliverableType], state: "pending", unitId, deliverableId: previous.deliverableId,
            revisionProposal: { deliverableId: previous.deliverableId, baseVersion: { deliverableId: previous.deliverableId, versionId: `ver_mock_${current.currentVersion}`, number: current.currentVersion }, request: text, executionScope: targeted ? "targeted_change" : "full_regeneration", changeSummary: targeted ? "Se ajustará solo el elemento indicado del diagrama." : "Se regenerará el entregable completo con esta instrucción; la versión anterior quedará en el historial.", ...(targeted ? { preview: `Antes: ${previous.summary ?? "versión actual"}\nDespués: ${text}` } : {}) } };
        reply = add(record, "flu", "intent_to_confirm", "Entiendo la corrección. Revisa qué se modificaría antes de aplicarla.", { intent });
    } else if (/(recuerda|guarda (?:este )?dato)/i.test(lower)) {
        const fact = text.replace(/^(recuerda(?: que)?|guarda (?:este )?dato(?: de que)?)\s*/i, "").trim() || text;
        const intent: MockIntent = { id: next("intent"), intentKind: "save_context", target: "package", deliverableTypes: [], state: "pending", contextProposal: { text: fact, scope: "unit", unitId: `unit_mock_context_${id}` }, unitId: `unit_mock_context_${id}` };
        reply = add(record, "flu", "intent_to_confirm", "Puedo guardar ese dato para retomarlo en esta conversación.", { intent });
    } else {
        const type: DeliverableType | undefined = /presentaci[oó]n/i.test(lower) ? "presentation" : /diagrama/i.test(lower) ? "diagram_as_is" : /diagn[oó]stico/i.test(lower) ? "diagnostic" : /pol[ií]tica/i.test(lower) ? "policy_draft" : record.awaiting;
        if (type && (text.length > 75 || record.awaiting === type)) {
            record.awaiting = undefined;
            reply = offer(record, type, text);
        } else if (type) {
            record.awaiting = type;
            reply = add(record, "flu", "clarification", `Claro. Para preparar ${typeLabel[type] ?? "el entregable"}, ¿cuál es el objetivo y qué reglas o pasos debemos respetar?`, { clarification: { prompt: "Cuéntame el objetivo y el alcance.", suggestions: ["Aplica a compras menores a $10,000; Dirección aprueba y Finanzas registra."] } });
        } else {
            reply = add(record, "flu", "text", lower.trim() === "hola" ? "Hola. Podemos explorar tu proceso, usar fuentes o preparar un entregable cuando tengamos contexto suficiente. ¿Qué te gustaría trabajar?" : "Te sigo. Para aterrizarlo en un entregable de consultoría, cuéntame el proceso, el objetivo o la decisión que quieres documentar. También puedes adjuntar una fuente. **Esta respuesta es de la demo local, no del modelo real.**");
        }
    }
    return clone({ userMessage, reply });
};
export const mockListChatSources = (id: string): { sources: Source[] } => ({ sources: clone(must(id).sources) });
export const mockGetChatSource = (projectId: string, sourceId: string): Source => {
    const source = [...records.values()].flatMap((record) => record.sources).find((item) => item.projectId === projectId && item.id === sourceId);
    if (!source) throw new Error("No se encontró el archivo del chat de demostración.");
    return clone(source);
};
export const mockGetChatSourceBlob = (sourceId: string): Blob | undefined => uploadedSourceBlobs.get(sourceId);
export const mockUploadChatSource = (id: string, file: File): Source => {
    if (file.size > 25 * 1024 * 1024) throw new Error("El archivo excede 25 MB en la demostración local.");
    const record = must(id);
    const source: Source = { id: next("source"), projectId: record.chat.projectId, name: file.name, mime: file.type || "application/octet-stream", size: file.size, kind: file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "document", status: "ready", currentVersion: 1, createdAt: now() };
    record.sources.push(source);
    uploadedSourceBlobs.set(source.id, file);
    add(record, "system", "text", "Archivo añadido a este chat. En la demostración local no se envía a ningún proveedor.", { refs: { sourceIds: [source.id] } });
    return clone(source);
};
export const mockDismissChatIntent = (id: string, intentId: string): void => {
    const message = must(id).messages.find((item) => item.intent?.id === intentId);
    if (!message?.intent || message.intent.state !== "pending") throw new Error("Esta propuesta ya no está pendiente.");
    message.intent.state = "dismissed";
};
export const mockConfirmChatIntent = (id: string, intentId: string): JobRef | ContextContribution => {
    const record = must(id);
    const message = record.messages.find((item) => item.intent?.id === intentId);
    const intent = message?.intent;
    if (!intent || intent.state !== "pending") throw new Error("Esta propuesta ya no está pendiente.");
    intent.state = "confirmed";
    if (intent.intentKind === "save_context") {
        const contribution: ContextContribution = { id: next("fact"), unitId: intent.unitId ?? `unit_mock_context_${id}`, text: intent.contextProposal!.text, author: "Usuario demo", createdAt: now(), originChatId: id, sourceMessageId: message.id, state: "active" };
        record.facts.push(contribution);
        add(record, "flu", "text", "Dato guardado en el contexto de esta demostración. Ningún entregable cambió.", { refs: { contributionIds: [contribution.id] } });
        return clone(contribution);
    }
    const type = intent.deliverableTypes[0];
    const unitId = intent.unitId ?? next("unit");
    const requestedName = intent.newUnit?.name;
    const jobId = next("job");
    intent.jobId = jobId;
    intent.unitId = unitId;
    delete intent.newUnit;
    const status = (phase: "queued" | "running" | "done", label: string) => add(record, "flu", "generation_status", label, { unitId, refs: { jobId }, generationStatus: { jobId, target: "deliverable", deliverableTypes: [type], phase, stepLabel: label } });
    status("queued", "Solicitud recibida");
    window.setTimeout(() => status("running", `Elaborando ${typeLabel[type] ?? "entregable"}`), 650);
    window.setTimeout(() => {
        const deliverable = intent.intentKind === "revise_deliverable" && intent.deliverableId
            ? mockAdvanceDeliverableVersion(record.chat.projectId, intent.deliverableId)
            : (() => { mockCreateDeliverable(record.chat.projectId, { unitId, type, from: record.sources.map((item) => item.id) }); return mockListDeliverables(record.chat.projectId, { unitId, type })[0]; })();
        const conversation = record.messages.filter((item) => item.role === "user").map((item) => item.text).join(" ");
        const previousNote = deliverable.currentVersion > 1 ? mockGetChatPreviewNote(deliverable.id, deliverable.currentVersion - 1) : undefined;
        mockSetChatPreviewNote(deliverable.id, deliverable.currentVersion,
            intent.revisionProposal ? `${previousNote ?? conversation}\n${intent.revisionProposal.request}` : conversation || requestedName || record.chat.title);
        status("done", `${typeLabel[type] ?? "Entregable"} listo`);
        add(record, "flu", "deliverable_card", `Puedes revisar la versión ${deliverable.currentVersion}.`, { unitId, refs: { jobId, deliverableIds: [deliverable.id] }, deliverableCard: { deliverableId: deliverable.id, deliverableType: type, status: "ready", outcome: "generated", version: { id: `ver_mock_${deliverable.currentVersion}`, number: deliverable.currentVersion }, summary: intent.revisionProposal ? `Incluye: ${intent.revisionProposal.request}` : `Borrador visual creado a partir de esta conversación.`, title: titleIn(intent.revisionProposal?.request ?? "") ?? requestedName ?? typeLabel[type] } as NonNullable<MockMessage["deliverableCard"]> & { title: string } });
    }, 1700);
    return { jobId };
};
export const mockGetChatMovePreview = (id: string, projectId: string): ChatMovePreview => {
    const record = must(id);
    const cards = record.messages.filter((item) => item.deliverableCard && item.unitId);
    const unitIds = [...new Set(cards.map((item) => item.unitId!))];
    return { chatId: id, fromProjectId: record.chat.projectId, toProjectId: projectId, units: unitIds.map((unitId) => ({ unitId, name: "Unidad del chat", kind: "document" })), deliverables: cards.map((item) => ({ deliverableId: item.deliverableCard!.deliverableId, type: item.deliverableCard!.deliverableType, unitId: item.unitId!, versions: item.deliverableCard!.version?.number ?? 1 })), sources: record.sources.map((item) => ({ sourceId: item.id, name: item.name })), contributions: record.facts.map((item) => ({ contributionId: item.id, text: item.text })), messageCount: record.messages.length, previewId: `${id}:${projectId}:${record.messages.length}:${record.sources.length}` };
};
export const mockMoveChat = (id: string, projectId: string, previewId: string): Chat => {
    const record = must(id);
    const preview = mockGetChatMovePreview(id, projectId);
    if (preview.previewId !== previewId) throw new Error("La vista previa cambió. Revísala otra vez.");
    mockMoveChatDeliverables(record.chat.projectId, projectId, preview.units.map((item) => item.unitId));
    record.chat.projectId = projectId; record.chat.unassigned = false; record.chat.updatedAt = now();
    for (const source of record.sources) source.projectId = projectId;
    return clone(record.chat);
};
