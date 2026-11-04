import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChatMarkdown } from "@/components/custom/chat-markdown";
import { Link, useSearchParams } from "react-router";
import { ConsultationDeliverableCard, type Card } from "@/components/custom/consultation-deliverable-card";
import { CompartirModal } from "@/components/custom/compartir-modal";
import { ConsultationQuestions } from "@/components/custom/consultation-questions";
import { ReadableQuestionPrompt } from "@/components/custom/readable-question-prompt";
import { ManualVersionModal } from "@/components/custom/manual-version-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/hooks/use-auth";
import { useAuthContext } from "@/contexts/auth-context";
import { useTheme } from "@/providers/theme-provider";
import { useUploadBatches } from "@/hooks/use-upload-batches";
import { hasCapability } from "@/lib/capabilities";
import { useChatEvents } from "@/hooks/use-chat-events";
import { validateUploadFiles } from "@/hooks/upload-batch-manager";
import { isMockMode } from "@/config/api-mode";
import { createProject, getProject, listProjectsPage, type V2Project } from "@/services/v2/projects";
import {
    answerChatQuestionGroup,
    confirmChatIntent,
    createChat,
    dismissChatIntent,
    getChat,
    getChatUpdates,
    getChatMovePreview,
    listChatSources,
    orderChatSources,
    listChats,
    moveChat,
    mergeChatUpdates,
    mergeChatEventMessage,
    cancelChatTurn,
    sendChatMessage,
    streamChatMessage,
    uploadChatSource,
    updateChat,
    type Chat,
    type ChatExchange,
    type ChatMovePreview,
    type ChatSession,
} from "@/services/v2/chats";
import { ApiServiceError, manualVersionConflicts, type ManualVersionConflict } from "@/services/v2/http";
import { deliverableLabel } from "@/services/v2/labels";
import { getDeliverable } from "@/services/v2/deliverables";
import { cancelJob, getJob } from "@/services/v2/jobs";
import { listAvailableModels, type ModelList } from "@/services/v2/models";
import type { ConsultationMessage, GenerationIntent, Job, PermissionPending, Source } from "@/services/v2/types";
import type { components } from "@/lib/api-schema";
import { ChatJobActivity } from "./chat-job-activity";
import { ChatReference } from "./chat-reference";
import { ChatDeliverableTile } from "./chat-deliverable-tile";
import { ChatComposer } from "./chat-composer";
import { ChatUploadBatch } from "./chat-upload-batch";
import { ChatStreamResponse } from "./chat-stream-response";
import { ChatActivity, ChainWorkActivity, SavedChainActivity, SavedChatActivity } from "./chat-activity";
import { beginLiveTurn, reduceLiveTurn, type LiveTurn } from "./chat-stream-state";
import { buildChatTimeline } from "./chat-timeline";
import { collectChainBlocks } from "./chat-chain-state";
import { activityFromJob, isTerminalJob } from "./chat-job-state";
import { ChatPermissions } from "./chat-permissions";
import { ChatJobDetails } from "./chat-job-details";
import { getMemorySettings } from "@/services/v2/memories";
import { FluMemoryPanel } from "./flu-memory-panel";
import { FluResizeHandle } from "./flu-resize-handle";
import { FluSourceTools } from "./flu-source-tools";
import { FluSourcePreview, SourceTypeIcon } from "./flu-source-preview";
import "./flu-chats.css";

type ChatMessage = ConsultationMessage & { unitId?: string };
type ChatIntent = GenerationIntent & {
    unitId?: string;
    newUnit?: { name: string; kind: string };
    deliverableId?: string;
};

const ChatIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-9.5A7.5 7.5 0 0 1 10.5 4h2A7.5 7.5 0 0 1 20 11.5Z" /></svg>;
const FolderIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5v-12Z" /></svg>;
const ChevronIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m8 10 4 4 4-4" /></svg>;
const LogoutIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4M8 12h10" /></svg>;
const ContextIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M15 4v16M6.5 8h5M6.5 12h5" /></svg>;
const EditIcon = () => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 20 4.5-1 10.8-10.8a2 2 0 0 0-2.8-2.8L5.7 16.2 4 20Z" /><path d="m14.8 6.2 2.8 2.8" /></svg>;
const DeliverableTypeIcon = ({ type }: { type: Card["deliverableType"] }) => <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {type === "diagram_as_is" ? <><circle cx="5" cy="6" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="5" cy="18" r="2" /><path d="M7 6h5v6h5M7 18h5v-6" /></> : type === "presentation" ? <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4" /></> : type === "diagnostic" ? <><path d="M4 19V9m5 10V5m5 14v-7m5 7v-9M3 20h18" /></> : type === "translation" ? <><path d="M3 6h12M9 3v3m4 0c-.4 5.7-3.5 9-9 11m2-7c1.5 2.5 3.5 4.3 6 5" /><path d="m15 20 3-8 3 8m-5-2h4" /></> : type === "transcription" ? <><path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4" /></> : type === "understanding" ? <><circle cx="12" cy="8" r="4" /><path d="M8 12v2a4 4 0 0 0 8 0v-2M9 20h6" /></> : <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>}
</svg>;
class ChatUserError extends Error {}

function messageDate(value: string) {
    return new Date(value).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
}

function cardTitle(card: Card): string {
    return "title" in card && typeof card.title === "string" && card.title.trim() ? card.title : deliverableLabel(card.deliverableType);
}

function itemCount(count: number, singular: string, plural: string): string { return `${count} ${count === 1 ? singular : plural}`; }

function intentDestination(intent: ChatIntent): string {
    if (intent.intentKind === "save_context") return "Dato que quedará registrado con su procedencia";
    if (intent.destinations?.length) return `${intent.destinations.length} destinos propuestos para ${intent.destinations.reduce((total, destination) => total + destination.deliverableTypes.length, 0)} entregables`;
    if (intent.newUnit) return `Nombre propuesto: ${intent.newUnit.name}`;
    if (intent.deliverableId) return "Cambio sobre el entregable indicado";
    return "Acción sobre un entregable existente";
}

function visibleMessageText(item: ChatMessage): string {
    const intent = item.intent as ChatIntent | undefined;
    if (item.refs?.sourceIds?.length && item.text.startsWith("Archivo añadido a este chat.") && item.text.includes("No pude leer")) return "Archivo añadido a este chat.";
    if (item.kind !== "intent_to_confirm" || !intent) return item.text;
    const types = (intent.destinations?.flatMap((destination) => destination.deliverableTypes) ?? intent.deliverableTypes)
        .map((type) => deliverableLabel(type).toLocaleLowerCase("es-MX")).join(" y ");
    if (intent.state === "dismissed") return "Propuesta descartada.";
    if (intent.state === "confirmed") return "Propuesta confirmada.";
    if (intent.state === "expired") return "Esta propuesta ya venció.";
    if (intent.intentKind === "save_context") return "Te propongo guardar este dato para tenerlo en cuenta después.";
    if (intent.intentKind === "revise_deliverable") return "Te propongo un cambio al entregable.";
    if (intent.intentKind === "generate" || !intent.intentKind) return `Te propongo preparar ${types || "el entregable"}.`;
    return item.text;
}

function chatErrorForUser(error: unknown, fallback: string): string {
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
        case "source_not_permitted": return error.message?.trim() || "Una fuente necesita permiso para el proveedor indicado. Revisa los permisos del archivo y vuelve a intentarlo.";
        case "model_not_available": return "El modelo elegido dejó de estar disponible. Selecciona uno de los modelos habilitados y vuelve a pedirlo; no se cambió de modelo a escondidas.";
        case "job_not_pausable": return "Este trabajo ya no se puede pausar. Actualiza su estado.";
        case "job_not_resumable": return "Este trabajo ya no se puede reanudar. Actualiza su estado.";
        case "job_control_via_parent": return "Controla el paquete completo desde su trabajo principal.";
        case "internal_error": return fallback;
        default: return error.message?.trim() || fallback;
    }
}

/** Interfaz conversacional sobre el contrato real /chats. */
export const FluChatsPage = () => {
    usePageTitle("Chats de Flu3nce");
    const { logout } = useAuth();
    const { user } = useAuthContext();
    const { theme, setTheme } = useTheme();
    const [params, setParams] = useSearchParams();
    const projectId = params.get("project") ?? "";
    const chatId = params.get("chat") ?? "";
    const directoryOpen = params.get("view") === "all";
    const [projects, setProjects] = useState<V2Project[]>([]);
    const [projectsCursor, setProjectsCursor] = useState<string | undefined>();
    const [chats, setChats] = useState<Chat[]>([]);
    const [looseChats, setLooseChats] = useState<Chat[]>([]);
    const [chatsCursor, setChatsCursor] = useState<string | undefined>();
    const [session, setSession] = useState<ChatSession | null>(null);
    const [olderMessages, setOlderMessages] = useState<ChatMessage[]>([]);
    const [olderCursor, setOlderCursor] = useState<string | undefined>();
    const [sources, setSources] = useState<Source[]>([]);
    const [sourcesCursor, setSourcesCursor] = useState<string | undefined>();
    const [sourcesError, setSourcesError] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [firstMessage, setFirstMessage] = useState("");
    const [stagedFiles, setStagedFiles] = useState<File[]>([]);
    const { batches: uploadBatches, manager: uploadManager } = useUploadBatches(user?.userId ?? "anonymous", !isMockMode);
    const visibleUploadBatches = uploadBatches.filter((record) => record.chatId === chatId);
    const activeUploadBatch = visibleUploadBatches.find((record) => !record.batch || !["sent", "cancelled", "expired"].includes(record.batch.state));
    const refreshedUploadBatches = useRef(new Set<string>());
    const [modelCatalog, setModelCatalog] = useState<ModelList | null>(null);
    const [modelAvailability, setModelAvailability] = useState<"loading" | "available" | "unavailable" | "error">("loading");
    const [chosenModel, setChosenModel] = useState("");
    const [liveTurn, setLiveTurn] = useState<LiveTurn | null>(null);
    const liveTurnRef = useRef<LiveTurn | null>(null);
    const [stoppedJobs, setStoppedJobs] = useState<Set<string>>(() => new Set());
    const [verifiedJobs, setVerifiedJobs] = useState<Record<string, Job>>({});
    const [announcedJobs, setAnnouncedJobs] = useState<Set<string>>(() => new Set());
    const [exchangeMetadata, setExchangeMetadata] = useState<Record<string, { requestId?: string; failure?: components["schemas"]["TurnFailure"]; permissionsPending?: PermissionPending[] }>>({});
    const [referencePreference, setReferencePreference] = useState<{ userId: string; enabled: boolean } | null>(null);
    const showReferences = !!user?.userId && referencePreference?.userId === user.userId && referencePreference.enabled;
    useEffect(() => {
        if (!user?.userId) { setReferencePreference(null); return; }
        let enabled = false;
        try { enabled = window.localStorage.getItem(`flu:show-reference-ids:${user.userId}`) === "true"; } catch { /* Storage can be unavailable. */ }
        setReferencePreference({ userId: user.userId, enabled });
    }, [user?.userId]);
    const toggleReferences = () => {
        if (!user?.userId) return;
        const enabled = !showReferences;
        setReferencePreference({ userId: user.userId, enabled });
        try { window.localStorage.setItem(`flu:show-reference-ids:${user.userId}`, String(enabled)); } catch { /* Keep the current session usable. */ }
    };
    const [stoppingFlu, setStoppingFlu] = useState(false);
    const jobTurns = useRef(new Map<string, string>());
    const requestTurns = useRef(new Map<string, string>());
    const updateLiveTurn = useCallback((change: (current: LiveTurn | null) => LiveTurn | null) => { const next = change(liveTurnRef.current); liveTurnRef.current = next; setLiveTurn(next); }, []);
    const turnConnection = useRef<{ clientMessageId: string; controller: AbortController; cancellationConfirmed: boolean; turnId?: string } | null>(null);
    useEffect(() => () => turnConnection.current?.controller.abort(), []);
    const [draggingFiles, setDraggingFiles] = useState(false);
    const [unreadChats, setUnreadChats] = useState<Set<string>>(() => new Set());
    const [chatSearch, setChatSearch] = useState("");
    const [expandedProjectId, setExpandedProjectId] = useState<string | null>(projectId || null);
    const [navOpen, setNavOpen] = useState(() => window.innerWidth > 760);
    const [contextOpen, setContextOpen] = useState(false);
    const previousViewportWidth = useRef(window.innerWidth);
    const [openLibrarySignal, setOpenLibrarySignal] = useState(0);
    const [busy, setBusy] = useState(false);
    const [activity, setActivity] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [unavailable, setUnavailable] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [moveProjectId, setMoveProjectId] = useState("");
    const [movePreview, setMovePreview] = useState<ChatMovePreview | null>(null);
    const [moveOpen, setMoveOpen] = useState(false);
    const [projectCreateOpen, setProjectCreateOpen] = useState(false);
    const [projectNameDraft, setProjectNameDraft] = useState("");
    const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
    const [projectCreateError, setProjectCreateError] = useState<string | null>(null);
    const [manualConfirmation, setManualConfirmation] = useState<{ intentId: string; conflicts: ManualVersionConflict[] } | null>(null);
    const [membersOpen, setMembersOpen] = useState(false);
    const [openedDeliverable, setOpenedDeliverable] = useState<{ card: Card; unitId: string } | null>(null);
    const [openedSource, setOpenedSource] = useState<Source | null>(null);
    const [memoryOpen, setMemoryOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [renamingChat, setRenamingChat] = useState(false);
    const [chatTitleDraft, setChatTitleDraft] = useState("");
    const [navWidth, setNavWidth] = useState(274);
    const [contextWidth, setContextWidth] = useState(330);
    const [panelWidth, setPanelWidth] = useState(550);
    const [panelMaximized, setPanelMaximized] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
    const [memoryAvailable, setMemoryAvailable] = useState(false);
    const sourceInput = useRef<HTMLInputElement>(null);
    const navOpenButton = useRef<HTMLButtonElement>(null);
    const navCloseButton = useRef<HTMLButtonElement>(null);
    const accountButton = useRef<HTMLButtonElement>(null);
    const userMenu = useRef<HTMLDivElement>(null);
    const deliverablePanel = useRef<HTMLElement>(null);
    const chatLog = useRef<HTMLDivElement>(null);
    const dragDepth = useRef(0);
    const nearChatBottom = useRef(true);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [newReplyBelow, setNewReplyBelow] = useState(false);
    const lastRenderedMessageId = useRef<string | undefined>(undefined);
    const loadedOlder = useRef(false);
    const latestMessageId = useRef<string | undefined>(undefined);
    const pollingChatId = useRef<string | null>(null);
    const refreshVersion = useRef(0);
    const activeChatId = useRef(chatId);
    const chatUpdateMarkers = useRef<Map<string, string>>(new Map());
    const streamEnabled = useRef<boolean | null>(null);
    activeChatId.current = chatId;

    const selectedProject = projects.find((project) => project.id === projectId);
    const accountName = user?.displayName?.trim() || user?.userId || "Usuario";
    const accountInitial = Array.from(accountName)[0]?.toLocaleUpperCase("es-MX") || "U";
    const maxContextWidth = viewportWidth <= 1200 ? Math.floor(viewportWidth * .85) : Math.max(280, viewportWidth - (navOpen ? navWidth : 0) - 320);
    const visibleContextWidth = Math.min(contextWidth, maxContextWidth);
    const maxPanelWidth = viewportWidth <= 940 ? viewportWidth : Math.max(360, viewportWidth - (navOpen ? navWidth : 0) - 320);
    const visiblePanelWidth = Math.min(panelWidth, maxPanelWidth);
    const canWrite = session?.chat.access === "owner";
    const canOperate = canWrite && hasCapability(user, "chat");
    const canStartInScope = hasCapability(user, "chat") && (!projectId || (!!selectedProject && selectedProject.rol !== "lector"));
    const modelControls = modelCatalog ? { catalog: modelCatalog, selected: chosenModel || modelCatalog.default, onChange: setChosenModel } : undefined;

    const refreshModels = useCallback(async () => {
        setModelAvailability("loading");
        try {
            const catalog = await listAvailableModels();
            setModelCatalog(catalog);
            setChosenModel((current) => catalog?.models.some((model) => model.id === current) ? current : catalog?.default ?? "");
            setModelAvailability(catalog ? "available" : "unavailable");
        } catch {
            setModelCatalog(null);
            setModelAvailability("error");
        }
    }, []);
    const modelStatus = !isMockMode && !modelCatalog ? { state: modelAvailability === "available" ? "loading" as const : modelAvailability, onRetry: () => { void refreshModels(); } } : undefined;

    useEffect(() => {
        const onResize = () => {
            const width = window.innerWidth;
            if (previousViewportWidth.current > 760 && width <= 760) {
                setNavOpen(false);
                setContextOpen(false);
            }
            previousViewportWidth.current = width;
            setViewportWidth(width);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        if (!userMenuOpen) return;
        const onPointerDown = (event: PointerEvent) => {
            if (event.target instanceof Node && !userMenu.current?.contains(event.target) && !accountButton.current?.contains(event.target)) setUserMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") { setUserMenuOpen(false); accountButton.current?.focus(); }
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => { document.removeEventListener("pointerdown", onPointerDown); document.removeEventListener("keydown", onKeyDown); };
    }, [userMenuOpen]);

    const watchChatSummaries = useCallback((items: Chat[]) => {
        for (const item of items) {
            const previous = chatUpdateMarkers.current.get(item.id);
            chatUpdateMarkers.current.set(item.id, item.updatedAt);
            if (!previous || previous === item.updatedAt || item.id === activeChatId.current) continue;
            void getChat(item.id).then((updated) => {
                const latest = updated.messages[0];
                if (activeChatId.current !== item.id && latest?.role === "flu" && Date.parse(latest.createdAt) >= Date.parse(previous)) {
                    setUnreadChats((current) => new Set(current).add(item.id));
                }
            }).catch(() => undefined);
        }
    }, []);

    const refreshList = useCallback(async () => {
        try {
            const page = await listChats(projectId ? { projectId } : { unassigned: true }, undefined, 10);
            watchChatSummaries(page.chats);
            setChats(page.chats);
            if (!projectId) setLooseChats(page.chats);
            setChatsCursor(page.nextCursor);
            setUnavailable(false);
            setError(null);
        } catch (caught) {
            if (caught instanceof ApiServiceError && caught.code === "consultation_disabled") setUnavailable(true);
            else setError("No se pudieron cargar los chats de esta cuenta. Comprueba la conexión o los permisos.");
        } finally {
            setLoading(false);
        }
    }, [projectId, watchChatSummaries]);

    const refreshChat = useCallback(async () => {
        if (!chatId) return;
        const version = ++refreshVersion.current;
        try {
            const next = await getChat(chatId);
            if (activeChatId.current !== chatId || version !== refreshVersion.current) return;
            latestMessageId.current = next.messages[0]?.id;
            setSession(next);
            if (!loadedOlder.current) setOlderCursor(next.nextCursor);
            setError(null);
        } catch {
            setError("No se pudo actualizar este chat. Los mensajes ya cargados siguen visibles.");
        }
    }, [chatId]);

    const pollChat = useCallback(async () => {
        if (!chatId || document.hidden || pollingChatId.current === chatId) return;
        const since = latestMessageId.current;
        if (!since) { await refreshChat(); return; }
        pollingChatId.current = chatId;
        const version = refreshVersion.current;
        try {
            const updates = await getChatUpdates(chatId, since);
            if (activeChatId.current !== chatId || version !== refreshVersion.current) return;
            if (updates.messages[0]) latestMessageId.current = updates.messages[0].id;
            setSession((current) => current?.chat.id === chatId ? mergeChatUpdates(current, updates) : current);
        } catch {
            // Una interrupción transitoria del sondeo no borra el historial visible.
        } finally {
            if (pollingChatId.current === chatId) pollingChatId.current = null;
        }
    }, [chatId, refreshChat]);

    const receiveChatMessage = useCallback((targetChatId: string, message: ConsultationMessage) => {
        if (activeChatId.current !== targetChatId) { if (message.role === "flu") setUnreadChats((current) => new Set(current).add(targetChatId)); return; }
        setSession((current) => {
            if (current?.chat.id !== targetChatId) return current;
            if (!current.messages.some((item) => item.id === message.id)) latestMessageId.current = message.id;
            return mergeChatEventMessage(current, message);
        });
    }, []);
    const chatEvents = useChatEvents(chatId, latestMessageId.current, !isMockMode && session?.chat.id === chatId, (message) => receiveChatMessage(chatId, message));

    useEffect(() => {
        if (!liveTurn || liveTurn.chatId !== chatId || !session) return;
        if (liveTurn.replyId && session.messages.some((message) => message.id === liveTurn.replyId)) {
            if (liveTurn.state !== "running") updateLiveTurn(() => null);
        } else if (liveTurn.state === "cancelled" && session.messages.some((message) => message.role === "flu" && message.text === "Respuesta detenida." && Date.parse(message.createdAt) >= liveTurn.startedAt)) updateLiveTurn(() => null);
    }, [session, liveTurn, chatId, updateLiveTurn]);

    useEffect(() => {
        for (const record of visibleUploadBatches) {
            if (record.batch?.state !== "sent") continue;
            const ids = new Set(session?.messages.map((message) => message.id));
            if (record.batch.messageId && ids.has(record.batch.messageId) && (!record.batch.turnId || ids.has(record.batch.turnId))) {
                uploadManager.dismiss(record.id);
            } else if (!refreshedUploadBatches.current.has(record.id)) {
                refreshedUploadBatches.current.add(record.id);
                void refreshChat();
                void listChatSources(record.chatId).then((page) => { if (activeChatId.current === record.chatId) { setSources(page.sources); setSourcesCursor(page.nextCursor); } }).catch(() => undefined);
            }
        }
    }, [uploadBatches, chatId, session, refreshChat, uploadManager]);

    useEffect(() => {
        void listProjectsPage().then((page) => {
            const active = page.projects.filter((item) => item.status === "active");
            setProjects((current) => [...active, ...current.filter((item) => !active.some((loaded) => loaded.id === item.id))]);
            setProjectsCursor(page.nextCursor);
        }).catch(() => setError("No se pudieron cargar los proyectos."));
        void getMemorySettings().then(() => setMemoryAvailable(true)).catch(() => setMemoryAvailable(false));
    }, []);

    useEffect(() => {
        if (isMockMode) return;
        void refreshModels();
    }, [refreshModels]);

    useEffect(() => {
        if (!projectId || projects.some((project) => project.id === projectId)) return;
        void getProject(projectId).then((project) => setProjects((current) => current.some((item) => item.id === project.id) ? current : [...current, project])).catch(() => undefined);
    }, [projectId, projects]);

    useEffect(() => { setLoading(true); setChats([]); setChatsCursor(undefined); void refreshList(); }, [refreshList]);

    useEffect(() => {
        if (!projectId) return;
        void listChats({ unassigned: true }, undefined, 10).then((page) => { watchChatSummaries(page.chats); setLooseChats(page.chats); }).catch(() => undefined);
    }, [projectId, watchChatSummaries]);

    useEffect(() => {
        const pollSummaries = async () => {
            if (document.hidden) return;
            try {
                const [loose, scoped] = await Promise.all([
                    listChats({ unassigned: true }, undefined, 10),
                    projectId ? listChats({ projectId }, undefined, 10) : Promise.resolve(null),
                ]);
                watchChatSummaries(loose.chats);
                setLooseChats((current) => [...loose.chats, ...current.filter((item) => !loose.chats.some((fresh) => fresh.id === item.id))]);
                if (scoped) {
                    watchChatSummaries(scoped.chats);
                    setChats((current) => [...scoped.chats, ...current.filter((item) => !scoped.chats.some((fresh) => fresh.id === item.id))]);
                }
            } catch { /* Una pausa de red no borra los indicadores existentes. */ }
        };
        const timer = window.setInterval(() => void pollSummaries(), 10000);
        return () => window.clearInterval(timer);
    }, [projectId, watchChatSummaries]);

    useEffect(() => { if (projectId) setExpandedProjectId(projectId); }, [projectId]);

    useEffect(() => {
        refreshVersion.current++;
        if (chatId) setUnreadChats((current) => { const next = new Set(current); next.delete(chatId); return next; });
        if (!busy) setStagedFiles([]);
        setDraggingFiles(false);
        dragDepth.current = 0;
        nearChatBottom.current = true;
        setShowScrollBottom(false);
        setNewReplyBelow(false);
        lastRenderedMessageId.current = undefined;
        latestMessageId.current = undefined;
        setSession(null);
        setOlderMessages([]);
        setOlderCursor(undefined);
        loadedOlder.current = false;
        setSources([]);
        setSourcesCursor(undefined);
        setSourcesError(null);
        setVerifiedJobs({}); setAnnouncedJobs(new Set()); setExchangeMetadata({});
        setMovePreview(null);
        setOpenedDeliverable(null);
        setOpenedSource(null);
        setMoveOpen(false);
        setRenamingChat(false);
        setUserMenuOpen(false);
        if (!chatId) return;
        void refreshChat();
        const timer = window.setInterval(() => void pollChat(), isMockMode ? 600 : 5000);
        const onVisible = () => { if (!document.hidden) void refreshChat(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
    }, [chatId, refreshChat, pollChat]);

    useEffect(() => {
        if (!openedDeliverable && !openedSource) return;
        deliverablePanel.current?.querySelector<HTMLElement>("button")?.focus();
        const onPanelKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") { setOpenedDeliverable(null); setOpenedSource(null); }
        };
        document.addEventListener("keydown", onPanelKeyDown);
        return () => document.removeEventListener("keydown", onPanelKeyDown);
    }, [openedDeliverable, openedSource]);

    useEffect(() => {
        if (!session?.chat.id) return;
        void listChatSources(session.chat.id).then((page) => { setSources(page.sources); setSourcesCursor(page.nextCursor); setSourcesError(null); }).catch(() => setSourcesError("No pude cargar los adjuntos de este chat."));
    }, [session?.chat.id]);

    useEffect(() => {
        if (!session?.chat.id || !sources.some((source) => source.status === "processing")) return;
        const timer = window.setInterval(() => {
            if (document.hidden) return;
            void listChatSources(session.chat.id).then((page) => {
                setSources((current) => current.length === page.sources.length && current.every((source, index) =>
                    source.id === page.sources[index].id && source.status === page.sources[index].status && source.name === page.sources[index].name && source.currentVersion === page.sources[index].currentVersion
                ) ? current : page.sources);
                setSourcesCursor(page.nextCursor);
            }).catch(() => undefined);
        }, 5000);
        return () => window.clearInterval(timer);
    }, [session?.chat.id, sources]);

    const messages = useMemo(() => {
        // El contrato entrega cada página de la más reciente a la más antigua.
        // Esa secuencia del servidor prevalece sobre createdAt: dos mensajes de un
        // mismo turno pueden compartir marca temporal o llegar con precisión distinta.
        const seen = new Set<string>();
        const newestFirst = [...(session?.messages ?? []), ...olderMessages].filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
        });
        return newestFirst.reverse();
    }, [olderMessages, session]);
    const jobActivities = useMemo(() => {
        const items = [...chatEvents.activities, ...(liveTurn?.chatId === chatId ? liveTurn.activities : [])].filter((item) => item.jobId);
        const unique = new Map<string, typeof items[number]>();
        for (const item of items) {
            const key = `${item.jobId}:${item.id}`, previous = unique.get(key);
            if (!previous || item.updatedAt >= previous.updatedAt) unique.set(key, item);
        }
        return [...unique.values()];
    }, [chatEvents.activities, liveTurn, chatId]);
    const chainBlocks = useMemo(() => collectChainBlocks(messages, chatEvents.chainBlocks), [messages, chatEvents.chainBlocks]);
    const timeline = useMemo(() => buildChatTimeline(messages, { blocks: chainBlocks, activities: jobActivities }), [messages, chainBlocks, jobActivities]);
    const liveJobs = useMemo(() => {
        const latest = new Map<string, string>();
        for (const jobId of announcedJobs) latest.set(jobId, "running");
        for (const message of messages) {
            if (message.generationStatus) latest.set(message.generationStatus.jobId, message.generationStatus.phase);
            for (const part of message.parts ?? []) if (part.kind === "activity_group" && part.activityGroup?.jobId) latest.set(part.activityGroup.jobId, "done");
        }
        for (const item of jobActivities) if (["running", "pending"].includes(item.state) && !["done", "failed", "cancelled"].includes(latest.get(item.jobId!) ?? "")) latest.set(item.jobId!, "running");
        for (const item of jobActivities) if (item.jobId && item.requestId && item.folded && isTerminalJob(item.state)) latest.set(item.jobId, item.state);
        return [...latest].reverse().filter(([jobId, phase]) => !stoppedJobs.has(jobId) && !isTerminalJob(verifiedJobs[jobId]?.status ?? "") && !["done", "failed", "cancelled"].includes(phase));
    }, [messages, stoppedJobs, verifiedJobs, jobActivities, announcedJobs]);
    // Even if activity.end arrived first, read the terminal result once for errors,
    // input traceability and saved outputs. This never re-enables the stop button.
    const liveJobKey = [...new Set([...liveJobs.map(([id]) => id), ...announcedJobs, ...jobActivities.flatMap((item) => item.jobId ? [item.jobId] : [])])].filter((id) => !isTerminalJob(verifiedJobs[id]?.status ?? "")).slice(0, 8).join("|");
    useEffect(() => {
        if (!chatId || !liveJobKey || isMockMode) return;
        let current = true;
        const ids = liveJobKey.split("|");
        const check = () => void Promise.all(ids.map(async (id) => {
            try {
                const job = await getJob(id);
                if (current) {
                    setVerifiedJobs((previous) => JSON.stringify(previous[id]) === JSON.stringify(job) ? previous : { ...previous, [id]: job });
                    // A result can be saved after the turn's reply; refresh its card too.
                    if (isTerminalJob(job.status)) void refreshChat();
                }
            } catch { /* The chat stream remains the fallback when job status is unavailable. */ }
        }));
        check();
        const timer = window.setInterval(check, 5000);
        return () => { current = false; window.clearInterval(timer); };
    }, [chatId, liveJobKey, refreshChat]);
    const chainJobIds = new Set([...chainBlocks.flatMap((block) => block.jobId ? [block.jobId] : []), ...jobActivities.flatMap((item) => item.requestId && item.jobId ? [item.jobId] : [])]);
    const orphanJobActivities = [...jobActivities.filter((item) => !item.requestId && !chainJobIds.has(item.jobId!)), ...Object.values(verifiedJobs).filter((job) => !chainJobIds.has(job.id) && !jobActivities.some((item) => item.jobId === job.id) && !isTerminalJob(job.status)).map(activityFromJob)].filter((item) => !timeline.some((entry) => entry.type === "job" && entry.jobId === item.jobId) && !messages.some((message) => message.parts?.some((part) => part.activityGroup?.jobId === item.jobId)));
    const visibleLiveTurn = liveTurn?.chatId === chatId && (!liveTurn.replyId || !messages.some((message) => message.id === liveTurn.replyId)) ? liveTurn : null;
    const lastUserMessageIndex = messages.reduce((latest, message, index) => message.role === "user" ? index : latest, -1);
    const visibleLooseChats = useMemo(() => looseChats.filter((chat) => chat.title.toLocaleLowerCase("es-MX").includes(chatSearch.toLocaleLowerCase("es-MX"))), [looseChats, chatSearch]);
    const visibleProjectChats = useMemo(() => chats.filter((chat) => chat.title.toLocaleLowerCase("es-MX").includes(chatSearch.toLocaleLowerCase("es-MX"))), [chats, chatSearch]);
    const sidebarProjects = useMemo(() => {
        const recent = projects.slice(0, 10);
        const selected = projects.find((project) => project.id === projectId);
        return selected && !recent.some((project) => project.id === selected.id) ? [selected, ...recent.slice(0, 9)] : recent;
    }, [projects, projectId]);
    const visibleDeliverables = useMemo(() => [...new Map(messages.filter((item) => item.deliverableCard).map((item) => [item.deliverableCard!.deliverableId, item])).values()], [messages]);
    const orderedSources = useMemo(() => orderChatSources(sources), [sources]);
    useEffect(() => { for (const item of jobActivities) if (item.jobId && item.requestId && requestTurns.current.has(item.requestId)) jobTurns.current.set(item.jobId, requestTurns.current.get(item.requestId)!); }, [jobActivities]);

    useEffect(() => {
        const node = chatLog.current;
        if (node && nearChatBottom.current) node.scrollTop = node.scrollHeight;
    }, [chatId, messages.length, messages[messages.length - 1]?.id, activity, visibleLiveTurn?.parts, visibleLiveTurn?.legacyText]);

    useEffect(() => {
        const newest = messages[messages.length - 1];
        if (!newest) return;
        if (lastRenderedMessageId.current && lastRenderedMessageId.current !== newest.id && newest.role === "flu" && !nearChatBottom.current) setNewReplyBelow(true);
        lastRenderedMessageId.current = newest.id;
    }, [messages]);

    const updateChatScroll = () => {
        const node = chatLog.current;
        if (!node) return;
        nearChatBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 96;
        setShowScrollBottom(!nearChatBottom.current);
        if (nearChatBottom.current) setNewReplyBelow(false);
    };

    const scrollToChatBottom = () => {
        const node = chatLog.current;
        if (!node) return;
        nearChatBottom.current = true;
        setShowScrollBottom(false);
        setNewReplyBelow(false);
        node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    };

    const run = async (work: () => Promise<void>, fallback: string) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        setNotice(null);
        try { await work(); }
        catch (caught) {
            setError(chatErrorForUser(caught, fallback));
            if (caught instanceof ApiServiceError && caught.code === "model_not_available") {
                void refreshModels();
            }
        }
        finally { setBusy(false); setActivity(null); }
    };

    const currentModel = () => modelCatalog ? chosenModel || modelCatalog.default : undefined;
    const rememberExchange = (targetChatId: string, exchange: ChatExchange) => {
        if (activeChatId.current !== targetChatId || !exchange.reply?.id) return;
        setExchangeMetadata((current) => ({ ...current, [exchange.reply.id]: { requestId: exchange.nucleo?.requestId, failure: exchange.failure, permissionsPending: exchange.permissionsPending } }));
        const jobId = exchange.reply.refs?.jobId ?? exchange.reply.intent?.jobId;
        if (jobId) setAnnouncedJobs((current) => new Set(current).add(jobId));
    };

    const sendPrompt = async (targetChatId: string, prompt: string, attachmentIds: string[] = []) => {
        const id = crypto.randomUUID();
        const options = { ...(currentModel() ? { model: currentModel() } : {}), ...(attachmentIds.length ? { attachmentIds } : {}) };
        if (!isMockMode && hasCapability(user, "stream") && streamEnabled.current !== false) {
            const controller = new AbortController();
            const connection = { clientMessageId: id, controller, cancellationConfirmed: false, turnId: undefined as string | undefined };
            turnConnection.current = connection;
            updateLiveTurn(() => beginLiveTurn(targetChatId, id, prompt));
            setActivity(null);
            try {
                const exchange = await streamChatMessage(targetChatId, prompt, id, options, (frame) => {
                    updateLiveTurn((current) => current?.clientMessageId === id ? reduceLiveTurn(current, frame) : current);
                    const { event, data } = frame;
                    const turn = liveTurnRef.current;
                    if (turn?.clientMessageId === id && turn.turnId) connection.turnId = turn.turnId;
                    if (turn?.requestId && turn.turnId) requestTurns.current.set(turn.requestId, turn.turnId);
                    if (turn?.turnId && typeof data.jobId === "string") jobTurns.current.set(data.jobId, turn.turnId);
                    if (event === "message" && data.userMessage && data.reply) {
                        rememberExchange(targetChatId, data as unknown as ChatExchange);
                        receiveChatMessage(targetChatId, data.userMessage as ConsultationMessage);
                        receiveChatMessage(targetChatId, data.reply as ConsultationMessage);
                    }
                    if (activeChatId.current !== targetChatId) return;
                    if (event === "done") {
                        if (turn?.jobIds?.length) {
                            setAnnouncedJobs((current) => new Set([...current, ...turn.jobIds!]));
                            if (turn.turnId) for (const jobId of turn.jobIds) jobTurns.current.set(jobId, turn.turnId);
                        }
                        if (turn?.replyId) setExchangeMetadata((current) => ({ ...current, [turn.replyId!]: { requestId: turn.requestId, failure: turn.failure, permissionsPending: turn.permissionsPending } }));
                    }
                    if (event === "received") { setDraft((current) => current.trim() === prompt ? "" : current); setFirstMessage((current) => current.trim() === prompt ? "" : current); }
                    if (!turn?.phaseB) {
                        const labels: Record<string, string> = { reading_sources: "Leyendo las fuentes…", searching: "Buscando en las fuentes…", tool: "Consultando herramientas…", model_call: "Pensando…", validating: "Verificando la respuesta…", retry: "Revisando la respuesta…" };
                        if (labels[event]) setActivity(labels[event]);
                    }
                }, controller.signal);
                if (exchange) {
                    streamEnabled.current = true;
                    if (!("cancelled" in exchange)) rememberExchange(targetChatId, exchange);
                    updateLiveTurn((current) => current?.clientMessageId === id && current.state === "running" ? reduceLiveTurn(current, { event: "cancelled" in exchange ? "cancelled" : "done", data: {} }) : current);
                    return exchange;
                }
                updateLiveTurn(() => null);
            } catch (error) {
                if (controller.signal.aborted && connection.cancellationConfirmed) return { cancelled: true as const, turnId: connection.turnId ?? "" };
                updateLiveTurn((current) => current?.clientMessageId === id && !["cancelled", "failed"].includes(current.state) ? { ...current, state: "interrupted" } : current);
                if (activeChatId.current === targetChatId) void refreshChat();
                throw error;
            } finally { if (turnConnection.current?.clientMessageId === id) turnConnection.current = null; }
            streamEnabled.current = false;
        }
        const exchange = await (Object.keys(options).length
            ? sendChatMessage(targetChatId, prompt, id, options)
            : sendChatMessage(targetChatId, prompt, id));
        rememberExchange(targetChatId, exchange);
        return exchange;
    };

    const sendFilesAndPrompt = async (targetChatId: string, files: File[], prompt: string) => {
        if (files.length && !isMockMode) {
            if (!prompt) throw new ChatUserError("Escribe qué quieres hacer con los archivos antes de enviarlos.");
            try { uploadManager.start(targetChatId, prompt, files, currentModel()); }
            catch (error) { throw new ChatUserError(error instanceof Error ? error.message : "No se pudo preparar el lote de archivos."); }
            setStagedFiles([]);
            setActivity(null);
            return;
        }
        const ids: string[] = [];
        for (const file of files) {
            setActivity(`Adjuntando ${file.name}…`);
            const source = await uploadChatSource(targetChatId, file);
            ids.push(source.id);
            setSources((current) => current.some((item) => item.id === source.id) ? current : [...current, source]);
            setStagedFiles((current) => current.filter((item) => item !== file));
        }
        if (prompt) {
            setActivity("Pensando cómo ayudarte…");
            await sendPrompt(targetChatId, prompt, ids);
        }
    };

    const stageFiles = (files: FileList | File[] | null) => {
        if (!files?.length || busy || !hasCapability(user, "attachments_multiple") || (!chatId && !canStartInScope) || (chatId && !canOperate)) return;
            const seen = new Set(stagedFiles.map((file) => `${file.name}\0${file.size}\0${file.lastModified}`));
            const next = [...stagedFiles, ...Array.from(files).filter((file) => {
                const key = `${file.name}\0${file.size}\0${file.lastModified}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })];
            try { validateUploadFiles(next); setStagedFiles(next); setError(null); }
            catch (error) { setError(error instanceof Error ? error.message : "No se pudieron añadir estos archivos."); }
    };

    const startFromMessage = (text: string) => void run(async () => {
        const prompt = text.trim();
        const files = [...stagedFiles];
        if ((!prompt && !files.length) || !canStartInScope) return;
        if (files.length && !isMockMode && !prompt) throw new ChatUserError("Escribe qué quieres hacer con los archivos antes de enviarlos.");
        setActivity(files.length ? "Adjuntando archivos…" : "Analizando tu solicitud…");
        const title = prompt ? `${prompt.slice(0, 54)}${prompt.length > 54 ? "…" : ""}` : files[0].name.replace(/\.[^.]+$/, "").slice(0, 54) || "Nuevo chat";
        const chat = await createChat(title, projectId || undefined);
        setParams(projectId ? { project: projectId, chat: chat.id } : { chat: chat.id });
        await refreshList();
        try {
            await sendFilesAndPrompt(chat.id, files, prompt);
            setFirstMessage("");
            setStagedFiles([]);

        } catch {
            if (prompt) setDraft(prompt);
            setError("El chat se creó, pero no se completó el envío. Revisa los archivos del chat antes de reintentar.");
        }
        await getChat(chat.id).then((next) => { latestMessageId.current = next.messages[0]?.id; setSession(next); }).catch(() => undefined);
    }, "No se pudo iniciar la conversación.");

    const sendText = (text: string) => void run(async () => {
        const files = [...stagedFiles];
        if (!chatId || (!text.trim() && !files.length) || !canOperate) return;
        if (activeUploadBatch) throw new ChatUserError("Espera a que termine el envío de archivos o cancélalo antes de enviar otra solicitud.");
        setActivity(files.length ? "Adjuntando archivos…" : "Pensando cómo ayudarte…");
        // Un mensaje nuevo sustituye cualquier autorización pendiente. No se
        // envía hasta que el servidor confirme que esas propuestas se descartaron.
        const pendingIds = session?.pendingIntentIds ?? messages
            .filter((item) => item.intent?.state === "pending")
            .map((item) => item.intent!.id);
        for (const intentId of new Set(pendingIds)) {
            try { await dismissChatIntent(chatId, intentId); }
            catch (caught) {
                if (!(caught instanceof ApiServiceError && caught.code === "intent_not_pending")) throw caught;
            }
        }
        await sendFilesAndPrompt(chatId, files, text.trim());
        if (text.trim()) setDraft("");

        await refreshChat();
        await refreshList();
    }, "No se completó el envío. Los archivos ya adjuntados permanecen en el chat; los demás siguen en la bandeja.");
    const send = () => sendText(draft);

    const confirm = (intentId: string, confirmReplaceManual = false) => void run(async () => {
        if (!canOperate) return;
        try {
            const result = await confirmChatIntent(chatId, intentId, confirmReplaceManual);
            setManualConfirmation(null);
            setNotice("jobId" in result ? null : "Dato guardado. Los entregables no cambiaron.");
            await refreshChat();
        } catch (caught) {
            const conflicts = manualVersionConflicts(caught);
            if (conflicts) { setManualConfirmation({ intentId, conflicts }); return; }
            if (caught instanceof ApiServiceError && caught.code === "revision_version_changed") {
                await refreshChat();
                throw new ChatUserError("El entregable cambió. No se aplicó nada; pide una propuesta nueva sobre la versión vigente.");
            }
            throw caught;
        }
    }, "No se pudo confirmar la propuesta.");

    const dismiss = (intentId: string) => void run(async () => {
        if (!canOperate) return;
        await dismissChatIntent(chatId, intentId);
        await refreshChat();
    }, "No se pudo descartar la propuesta.");

    const stopFlu = async () => {
        if (!canOperate || !hasCapability(user, "task_controls") || stoppingFlu) return;
        setStoppingFlu(true); setError(null);
        const turn = liveTurnRef.current?.chatId === chatId ? liveTurnRef.current : null;
        const ids = liveJobs.map(([id]) => id);
        updateLiveTurn((current) => current?.chatId === chatId ? { ...current, cancelRequested: true } : current);
        setStoppedJobs((current) => new Set([...current, ...ids]));
        try {
            const stopped = new Set<string>();
            const turnIds = new Set<string>([...(turn?.turnId ? [turn.turnId] : []), ...ids.flatMap((id) => jobTurns.current.has(id) ? [jobTurns.current.get(id)!] : [])]);
            let saved = 0, alreadyFinished = false;
            for (const turnId of turnIds) {
                const result = await cancelChatTurn(chatId, turnId);
                result.stoppedJobs?.forEach((id) => stopped.add(id));
                saved += result.saved?.length ?? 0;
                if (result.effect === "already_finished") {
                    alreadyFinished = true;
                    updateLiveTurn((current) => current?.turnId === turnId ? { ...current, cancelRequested: false } : current);
                }
                if (turn?.turnId === turnId && result.effect === "cancelled") {
                    updateLiveTurn((current) => current?.turnId === turnId ? { ...reduceLiveTurn(current, { event: "cancelled", data: {} }), cancelRequested: false } : current);
                    if (turnConnection.current?.clientMessageId === turn.clientMessageId) {
                        turnConnection.current.cancellationConfirmed = true;
                        turnConnection.current.controller.abort();
                    }
                }
            }
            for (const id of ids) if (!stopped.has(id)) {
                try { await cancelJob(id); }
                catch (error) {
                    if (error instanceof ApiServiceError && error.code === "job_control_via_parent" && typeof (error.detail as { parentJobId?: string })?.parentJobId === "string") {
                        const parent = (error.detail as { parentJobId: string }).parentJobId;
                        if (!stopped.has(parent)) { await cancelJob(parent); stopped.add(parent); }
                    } else if (!(error instanceof ApiServiceError && error.code === "job_not_cancellable")) throw error;
                }
            }
            setNotice(alreadyFinished && !ids.length ? "La respuesta ya había terminado." : saved ? `Flu3nce se detuvo. ${saved} ${saved === 1 ? "versión ya estaba guardada y se conserva" : "versiones ya estaban guardadas y se conservan"}.` : "Flu3nce se detuvo.");
            await refreshChat();
        } catch (error) {
            setStoppedJobs((current) => new Set([...current].filter((id) => !ids.includes(id))));
            updateLiveTurn((current) => current?.chatId === chatId ? { ...current, cancelRequested: false } : current);
            setError(chatErrorForUser(error, "No se pudo confirmar la cancelación. Vuelve a pulsar detener."));
        } finally { setStoppingFlu(false); }
    };
    const previewMove = () => void run(async () => {
        if (!moveProjectId) return;
        setMovePreview(await getChatMovePreview(chatId, moveProjectId));
    }, "No se pudo preparar la vista previa del movimiento.");

    const executeMove = () => void run(async () => {
        if (!movePreview) return;
        const moved = await moveChat(chatId, movePreview.toProjectId, movePreview.previewId);
        setMovePreview(null);
        setMoveOpen(false);
        setExpandedProjectId(moved.projectId);
        setParams({ project: moved.projectId, chat: moved.id });
        void listChats({ unassigned: true }).then((page) => setLooseChats(page.chats)).catch(() => undefined);
        setNotice("El chat y los elementos indicados se movieron al proyecto.");
    }, "No se movió el chat. Actualiza la vista previa y vuelve a intentarlo.");

    const openProject = (targetProjectId: string) => void run(async () => {
        const page = await listChats({ projectId: targetProjectId }, undefined, 10);
        setExpandedProjectId(targetProjectId);
        setParams(page.chats[0] ? { project: targetProjectId, chat: page.chats[0].id } : { project: targetProjectId });
        if (window.innerWidth <= 760) setNavOpen(false);
    }, "No se pudieron abrir los chats del proyecto.");

    const loadMoreProjects = () => void run(async () => {
        if (!projectsCursor) return;
        const page = await listProjectsPage(30, projectsCursor);
        setProjects((current) => [...current, ...page.projects.filter((next) => next.status === "active" && !current.some((item) => item.id === next.id))]);
        setProjectsCursor(page.nextCursor);
    }, "No se pudieron cargar más proyectos.");

    const renameChat = () => {
        const title = chatTitleDraft.trim();
        if (!session || !canWrite) return;
        if (!title) { setError("Escribe un nombre para el chat."); return; }
        if (title === session.chat.title) { setRenamingChat(false); return; }
        void run(async () => {
            const updated = await updateChat(session.chat.id, { title });
            setSession((current) => current?.chat.id === updated.id ? { ...current, chat: updated } : current);
            setChats((current) => current.map((item) => item.id === updated.id ? updated : item));
            setLooseChats((current) => current.map((item) => item.id === updated.id ? updated : item));
            setRenamingChat(false);
        }, "No se pudo renombrar el chat.");
    };

    const openProjectCreation = () => {
        setProjectCreateError(null);
        setProjectCreateOpen(true);
    };

    const submitProject = async () => {
        const name = projectNameDraft.trim();
        const description = projectDescriptionDraft.trim();
        if (!name) { setProjectCreateError("Escribe un nombre para el proyecto."); return; }
        setBusy(true);
        setProjectCreateError(null);
        try {
            const project = await createProject(name, description || undefined);
            setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
            setExpandedProjectId(project.id);
            setProjectCreateOpen(false);
            setProjectNameDraft("");
            setProjectDescriptionDraft("");
            setNotice("Proyecto creado. Ya puedes iniciar un chat dentro de él.");
            setParams({ project: project.id });
            if (window.innerWidth <= 760) setNavOpen(false);
        } catch {
            setProjectCreateError("No se pudo crear el proyecto. Comprueba el nombre e inténtalo de nuevo.");
        } finally {
            setBusy(false);
        }
    };

    const openDeliverable = (card: Card, unitId: string) => { setMemoryOpen(false); setOpenedSource(null); setOpenedDeliverable({ card, unitId }); };
    const openPartDeliverable = (card: Card) => {
        if (!session) return;
        const targetChat = chatId;
        void getDeliverable(session.chat.projectId, card.deliverableId).then((deliverable) => {
            if (activeChatId.current === targetChat) openDeliverable(card, deliverable.unitId);
        }).catch(() => { if (activeChatId.current === targetChat) setError("No se pudo abrir este entregable."); });
    };
    const openSource = (source: Source) => { setMemoryOpen(false); setOpenedDeliverable(null); setPanelWidth((current) => Math.max(current, Math.min(maxPanelWidth, 820))); setOpenedSource(source); };
    const closeMemory = useCallback(() => setMemoryOpen(false), []);
    const closePreview = () => { setOpenedDeliverable(null); setOpenedSource(null); setPanelMaximized(false); };
    const contextVisible = contextOpen && !openedDeliverable && !openedSource && !memoryOpen && !directoryOpen;
    return <main className={`flu-shell flex h-full min-h-0 min-w-0 flex-1 text-[color:var(--fl-text)] ${navOpen ? "nav-open" : "nav-closed"} ${contextVisible ? "context-open" : "context-closed"} ${chatId ? "is-conversation" : "is-welcome"} ${openedDeliverable || openedSource || memoryOpen ? "has-side-preview" : ""}`}>
        <input ref={sourceInput} type="file" multiple accept="audio/*,video/*,image/*,.txt,.pdf,.docx,.xlsx,.pptx,.webm" className="sr-only" aria-label="Seleccionar archivos para el chat" onChange={(event) => { stageFiles(event.target.files); event.currentTarget.value = ""; }} />
        {navOpen ? <button type="button" aria-label="Cerrar navegación" className="flu-mobile-backdrop" onClick={() => setNavOpen(false)} /> : null}
        <aside aria-label="Navegación de chats" aria-hidden={!navOpen} inert={!navOpen} className="flu-nav flex shrink-0 flex-col p-4" style={{ "--flu-nav-width": `${navWidth}px` } as CSSProperties}>
            <div className="flu-brand"><Link to="/flu" aria-label="Flu3nce, inicio"><img className="fl-logo-light" src="/landing/img/logo-fluence.svg" alt="Flu3nce" /><img className="fl-logo-dark" src="/landing/img/logo-fluence-white.svg" alt="" aria-hidden="true" /></Link><button ref={navCloseButton} type="button" aria-label="Plegar navegación" title="Plegar navegación" onClick={() => { setNavOpen(false); window.requestAnimationFrame(() => navOpenButton.current?.focus()); }}>‹</button></div>
            <p className="flu-label">ESPACIO DE TRABAJO</p>
            <button type="button" onClick={() => { setParams({}); setSession(null); setFirstMessage(""); setNavOpen(window.innerWidth > 760); }} className="flu-primary rounded-xl px-3 py-2.5 text-sm font-semibold text-white">＋ Nuevo chat</button>
            <label className="flu-search"><span aria-hidden="true">⌕</span><input aria-label="Buscar chats" value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Buscar chats" /></label>
            <div className="flu-nav-list mt-5 flex min-h-0 flex-1 flex-col overflow-y-auto">
                <p className="flu-nav-heading">CHATS</p>
                {visibleLooseChats.length ? visibleLooseChats.slice(0, 10).map((chat) => <button key={chat.id} type="button" onClick={() => { setParams({ chat: chat.id }); if (window.innerWidth <= 760) setNavOpen(false); }} className={`flu-chat-link ${chatId === chat.id ? "is-selected" : ""}`} title={unreadChats.has(chat.id) ? `${chat.title} · nueva respuesta` : chat.title}><ChatIcon /><span className="truncate">{chat.title}</span>{unreadChats.has(chat.id) ? <span className="flu-chat-unread-dot" title="Nueva respuesta de Flu3nce"><span className="sr-only">Nueva respuesta de Flu3nce</span></span> : null}</button>) : loading ? <div aria-label="Cargando chats" aria-busy="true" className="flu-chat-nav-skeleton"><div className="flu-chat-skeleton" /><div className="flu-chat-skeleton" /><div className="flu-chat-skeleton" /></div> : <p className="flu-nav-empty">{chatSearch ? "Sin coincidencias." : "Aún no hay chats aquí."}</p>}
                <button type="button" onClick={() => setParams({ view: "all" })} className="flu-more">Ver todos los chats</button>
                <div className="flu-project-heading-row"><p className="flu-nav-heading with-space">PROYECTOS</p><button type="button" onClick={openProjectCreation} aria-label="Crear proyecto" title="Crear proyecto">＋</button></div>
                {sidebarProjects.map((project) => {
                    const expanded = expandedProjectId === project.id;
                    return <div key={project.id} className="flu-project-group"><div className={`flu-project-row ${projectId === project.id ? "flu-project-selected" : ""}`}><button type="button" aria-expanded={expanded} aria-controls={`project-chats-${project.id}`} onClick={() => { if (expanded) setExpandedProjectId(null); else if (projectId === project.id) setExpandedProjectId(project.id); else openProject(project.id); }} className="flu-project-toggle min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-sm" title={project.name}><ChevronIcon /><FolderIcon /><span className="truncate">{project.name}</span></button>{project.rol !== "lector" ? <button type="button" aria-label={`Nuevo chat en ${project.name}`} title={`Nuevo chat en ${project.name}`} onClick={() => { setExpandedProjectId(project.id); setParams({ project: project.id }); setSession(null); setFirstMessage(""); if (window.innerWidth <= 760) setNavOpen(false); }} className="flu-project-new">＋</button> : null}</div>{expanded && projectId === project.id ? <div id={`project-chats-${project.id}`} className="flu-project-chats">{visibleProjectChats.length ? visibleProjectChats.slice(0, 10).map((chat) => <button key={chat.id} type="button" onClick={() => { setParams({ project: project.id, chat: chat.id }); if (window.innerWidth <= 760) setNavOpen(false); }} className={`flu-chat-link ${chatId === chat.id ? "is-selected" : ""}`} title={unreadChats.has(chat.id) ? `${chat.title} · nueva respuesta` : chat.title}><ChatIcon /><span className="truncate">{chat.title}{chat.shared ? " · compartido" : ""}</span>{unreadChats.has(chat.id) ? <span className="flu-chat-unread-dot" title="Nueva respuesta de Flu3nce"><span className="sr-only">Nueva respuesta de Flu3nce</span></span> : null}</button>) : <p className="flu-nav-empty">{loading ? "Cargando…" : "Aún no hay chats aquí."}</p>}{visibleProjectChats.length > 10 || chatsCursor ? <button type="button" onClick={() => setParams({ view: "all", project: project.id })} className="flu-more">Ver todos los chats</button> : null}</div> : null}</div>;
                })}
                <button type="button" onClick={() => setParams({ view: "all" })} className="flu-more">Ver todos los proyectos</button>
            </div>
            <div className="flu-account-area">
                <button ref={accountButton} type="button" className="flu-account-avatar" aria-label={`Abrir cuenta de ${accountName}`} aria-expanded={userMenuOpen} aria-controls="flu-account-menu" title={accountName} onClick={() => setUserMenuOpen((value) => !value)}>{accountInitial}</button>
                {userMenuOpen ? <div ref={userMenu} id="flu-account-menu" role="menu" aria-label="Cuenta" className="flu-account-menu">
                    <div className="flu-account-identity"><strong>{accountName}</strong>{user?.email ? <span>{user.email}</span> : null}</div>
                    <div className="flu-account-theme" role="group" aria-label="Apariencia">
                        <span>Apariencia</span>
                        <div className="flu-account-theme-options">
                            {([ ["light", "Claro"], ["dark", "Oscuro"], ["system", "Sistema"] ] as const).map(([value, label]) => <button key={value} type="button" role="menuitemradio" aria-checked={theme === value} onClick={() => setTheme(value)}>{label}</button>)}
                        </div>
                    </div>
                    <button type="button" role="menuitem" disabled={!memoryAvailable} onClick={() => { setUserMenuOpen(false); closePreview(); setMemoryOpen(true); if (viewportWidth <= 760) setNavOpen(false); }}><span aria-hidden="true">⚙</span> Memoria</button>
                    <button type="button" role="menuitemcheckbox" aria-checked={showReferences} onClick={toggleReferences}>Mostrar IDs de prueba {showReferences ? "✓" : ""}</button>
                    <button type="button" role="menuitem" onClick={() => void logout()}><LogoutIcon /> Cerrar sesión</button>
                </div> : null}
            </div>
            <FluResizeHandle label="Ajustar ancho de navegación" value={navWidth} min={220} max={480} direction={1} onChange={setNavWidth} />
        </aside>

        <section className="flu-main flex min-h-0 min-w-0 flex-1 flex-col" onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files") && !directoryOpen) { event.preventDefault(); dragDepth.current++; setDraggingFiles(true); } }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files") && !directoryOpen) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDragLeave={(event) => { if (event.dataTransfer.types.includes("Files")) { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDraggingFiles(false); } }} onDrop={(event) => { if (!directoryOpen && event.dataTransfer.files.length) { event.preventDefault(); stageFiles(event.dataTransfer.files); } dragDepth.current = 0; setDraggingFiles(false); }}>
            {draggingFiles ? <div className="flu-chat-drop-overlay" aria-hidden="true">Suelta los archivos para añadirlos a la bandeja</div> : null}
            <header className="flu-topbar flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flu-breadcrumb">{!navOpen ? <button ref={navOpenButton} type="button" aria-label="Abrir navegación" onClick={() => { setNavOpen(true); window.requestAnimationFrame(() => navCloseButton.current?.focus()); }} className="flu-icon-button">☰</button> : null}<span>{selectedProject?.name ?? "Chats"}</span><span aria-hidden="true">›</span>{renamingChat ? <form className="flu-chat-rename-form" onSubmit={(event) => { event.preventDefault(); renameChat(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setRenamingChat(false); } }}><input autoFocus aria-label="Nuevo nombre del chat" maxLength={120} value={chatTitleDraft} onChange={(event) => setChatTitleDraft(event.target.value)} /><button type="submit" disabled={busy || !chatTitleDraft.trim()}>Guardar</button><button type="button" onClick={() => setRenamingChat(false)}>Cancelar</button></form> : session && canWrite && !directoryOpen ? <button type="button" className="flu-chat-rename-trigger" aria-label="Renombrar chat" title="Renombrar chat" onClick={() => { setChatTitleDraft(session.chat.title); setRenamingChat(true); }}><span className="truncate">{session.chat.title}</span><EditIcon /></button> : <strong>{directoryOpen ? "Explorar" : session?.chat.title ?? "Nueva conversación"}</strong>}</div>
                {!directoryOpen ? <button type="button" aria-expanded={contextOpen && !openedDeliverable && !openedSource && !memoryOpen} aria-controls="flu-context" onClick={() => { if (openedDeliverable || openedSource || memoryOpen) { closePreview(); closeMemory(); setContextOpen(true); } else setContextOpen((value) => !value); }} className="flu-context-toggle flu-context-topbar-button"><ContextIcon />Contexto</button> : null}
            </header>
            {showReferences && chatId && !directoryOpen ? <div className="flu-chat-id-strip"><ChatReference chatId={chatId} /></div> : null}

            {unavailable ? <div role="alert" className="m-5 rounded-2xl border border-[color:var(--fl-warning-bg)] bg-[color:var(--fl-warning-bg)] p-5 text-sm">No se pudo abrir el chat para esta cuenta. Comprueba tu acceso y vuelve a intentarlo.</div> : null}
            {error ? <p role="alert" className="mx-5 mt-4 rounded-xl border border-[color:var(--fl-error-border)] bg-[color:var(--fl-error-bg)] px-4 py-3 text-sm text-[color:var(--fl-error-text)]">{error}</p> : null}
            {notice ? <p role="status" className="mx-5 mt-4 rounded-xl border border-[color:var(--fl-success-bg)] bg-[color:var(--fl-success-bg)] px-4 py-3 text-sm text-[color:var(--fl-success-text)]">{notice}</p> : null}

            {directoryOpen ? <div className="flu-directory min-h-0 flex-1 overflow-y-auto p-6 sm:p-10"><div className="flu-directory-inner">
                <p className="flu-eyebrow">TU ESPACIO</p><h1>Chats y proyectos</h1>
                <p className="flu-directory-intro">Abre un proyecto para continuar en su chat. Los elementos recientes permanecen en la barra lateral.</p>
                <div className="flu-directory-grid"><section><h2>{projectId ? `Chats de ${selectedProject?.name ?? "este proyecto"}` : "Chats sin proyecto"}</h2>
                    {(projectId ? visibleProjectChats : visibleLooseChats).map((chat) => <button key={chat.id} type="button" onClick={() => setParams(chat.unassigned ? { chat: chat.id } : { project: chat.projectId, chat: chat.id })} className="flu-directory-item"><ChatIcon /><span>{chat.title}</span><span aria-hidden="true">→</span></button>)}
                    {!(projectId ? visibleProjectChats : visibleLooseChats).length ? <p className="flu-directory-empty">Aún no hay chats en esta sección.</p> : null}
                    {chatsCursor ? <button type="button" disabled={busy} onClick={() => void run(async () => { const page = await listChats(projectId ? { projectId } : { unassigned: true }, chatsCursor); if (projectId) setChats((current) => [...current, ...page.chats.filter((next) => !current.some((item) => item.id === next.id))]); else setLooseChats((current) => [...current, ...page.chats.filter((next) => !current.some((item) => item.id === next.id))]); setChatsCursor(page.nextCursor); }, "No se pudieron cargar más chats.")} className="flu-directory-more">Cargar más chats</button> : null}
                </section><section><div className="flu-directory-section-head"><h2>Proyectos</h2><button type="button" onClick={openProjectCreation}>Nuevo proyecto</button></div>
                    {projects.filter((project) => project.name.toLocaleLowerCase("es-MX").includes(chatSearch.toLocaleLowerCase("es-MX"))).map((project) => <button key={project.id} type="button" onClick={() => openProject(project.id)} className="flu-directory-item"><FolderIcon /><span>{project.name}</span><span aria-hidden="true">→</span></button>)}
                    {!projects.length ? <p className="flu-directory-empty">Aún no hay proyectos.</p> : null}
                    {projectsCursor ? <button type="button" disabled={busy} onClick={loadMoreProjects} className="flu-directory-more">Cargar más proyectos</button> : null}
                </section></div></div></div> : !chatId ? <div className="flu-welcome-wrap flex min-h-0 flex-1 flex-col overflow-y-auto p-5">
                <div className="flu-welcome-card">
                    <div className="flu-welcome-icon" aria-hidden="true">✧</div>
                    <span className="flu-eyebrow">TU ESPACIO DE CONSULTORÍA</span>
                    <h1>¿Qué quieres construir hoy?</h1>
                    <div className="flu-suggestions">{["Ayúdame a crear un documento", "Quiero entender y mejorar un proceso", "Tengo archivos; ayúdame a empezar"].map((example) => <button key={example} type="button" disabled={busy || unavailable || !canStartInScope} onClick={() => startFromMessage(example)}>{example}<span aria-hidden="true">→</span></button>)}</div>
                    <ChatComposer id="flu-first-message" value={firstMessage} onChange={setFirstMessage} onSubmit={() => startFromMessage(firstMessage)} onAttach={() => sourceInput.current?.click()} attachments={stagedFiles} onRemoveAttachment={(index) => setStagedFiles((items) => items.filter((_, position) => position !== index))} modelControls={modelControls} modelStatus={modelStatus} disabled={busy || unavailable || !canStartInScope} attachDisabled={busy || unavailable || !canStartInScope || !hasCapability(user, "attachments_multiple")} label="Tu primer mensaje" submitLabel="Enviar primer mensaje" placeholder="Escribe lo que quieras explorar…" />
                </div>
            </div> : session ? <>
                <div ref={chatLog} onScroll={updateChatScroll} role="log" aria-label="Conversación" className="flu-log min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8">
                    <div className="mx-auto max-w-3xl space-y-4">
                        {olderCursor ? <button type="button" disabled={busy} onClick={() => void run(async () => { const page = await getChat(chatId, olderCursor); loadedOlder.current = true; setOlderMessages((items) => [...items, ...page.messages]); setOlderCursor(page.nextCursor); }, "No se pudo cargar el historial.")} className="mx-auto block text-xs font-bold text-[color:var(--fl-link)]">Ver mensajes anteriores</button> : null}
                        {messages.length === 0 && !visibleLiveTurn && !visibleUploadBatches.length ? <p className="py-16 text-center text-sm text-[color:var(--fl-text-4)]">Cuéntale a Flu3nce qué necesitas. Puedes aportar contexto o pedir un entregable desde cero.</p> : null}
                        {timeline.map((entry) => {
                            if (entry.type === "chain_activity") return <ChainWorkActivity key={`${entry.activity.requestId}:${entry.activity.id}`} activity={stoppedJobs.has(entry.activity.jobId ?? "") ? { ...entry.activity, state: "cancelled" } : entry.activity} connection={chatEvents.connection} />;
                            if (entry.type === "job") return <ChatJobActivity key={`job-${entry.jobId}`} jobId={entry.jobId} chatId={chatId} messages={entry.messages} projectId={session.chat.projectId} canOperate={canOperate && messages.indexOf(entry.messages[entry.messages.length - 1]) > lastUserMessageIndex} activities={jobActivities.filter((item) => item.jobId === entry.jobId)} connection={chatEvents.connection} stopped={stoppedJobs.has(entry.jobId)} verifiedJob={verifiedJobs[entry.jobId]} showReferences={showReferences} renderCards={false} busy={busy} onRetry={(intentId) => confirm(intentId)} onOpenDeliverable={openDeliverable} />;
                            const item = entry.message;
                            const activityGroup = !item.chainBlock ? item.parts?.find((part) => part.kind === "activity_group")?.activityGroup : undefined;
                            const actionsCurrent = messages.findIndex((message) => message.id === item.id) > lastUserMessageIndex;
                            const metadata = exchangeMetadata[item.id];
                            const displayText = item.intent?.state === "pending" && !actionsCurrent ? "Esta propuesta ya venció." : visibleMessageText(item);
                            const intent = item.intent as ChatIntent | undefined;
                            const revision = intent?.revisionProposal;
                            const revises = intent?.intentKind === "revise_deliverable";
                            const saves = intent?.intentKind === "save_context";
                            const supported = !!intent && [undefined, "generate", "save_context", "revise_deliverable"].includes(intent.intentKind) && (!revises || hasCapability(user, "revisions"));
                            const ready = saves ? !!intent?.contextProposal?.text : revises
                                ? !!intent?.unitId && !!intent?.deliverableId && !!revision && (revision.executionScope === "targeted_change" ? !!revision.preview?.trim() : revision.executionScope === "full_regeneration" && !revision.preview)
                                : !!intent && (intent.destinations?.length ? intent.destinations.every((destination) => destination.deliverableTypes.length > 0 && !!(destination.unitId || destination.newUnit)) : !!(intent.unitId || intent.newUnit));
                            return <article key={item.id} aria-label={`${item.role === "user" ? "Tu mensaje" : item.role === "system" ? "Mensaje del sistema" : "Respuesta de Flu3nce"}, ${messageDate(item.createdAt)}`} className={`flu-message min-w-0 rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === "user" ? "ml-auto flu-user" : "flu-assistant"}`}>
                                {item.parts?.some((part) => part.kind !== "activity_group") ? <div className="flu-message-parts">{item.parts.map((part, index) => {
                                    if (part.kind === "text" && part.text) return <Suspense key={index} fallback={<p className="whitespace-pre-wrap break-words">{part.text}</p>}><ReadableQuestionPrompt prompt={part.text} /></Suspense>;
                                    if (part.kind === "table" && part.table) return <div key={index} className="overflow-x-auto"><table className="flu-message-part-table"><thead><tr>{part.table.columns.map((column, cell) => <th key={cell} scope="col">{column}</th>)}</tr></thead><tbody>{part.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{part.table!.columns.map((_, cell) => <td key={cell}>{row[cell] ?? ""}</td>)}</tr>)}</tbody></table>{part.table.calculated ? <small>Los valores marcados «calculado» fueron calculados por Flu3nce.</small> : null}</div>;
                                    if (part.kind === "deliverable_card" && part.deliverableCard) return <ChatDeliverableTile key={index} card={part.deliverableCard} onOpen={() => openPartDeliverable(part.deliverableCard!)} />;
                                    if (part.kind === "question" && part.clarification) return <Suspense key={index} fallback={<p>{part.clarification.prompt}</p>}><ReadableQuestionPrompt prompt={part.clarification.prompt} /></Suspense>;
                                    return null;
                                })}</div> : <Suspense fallback={<p className="whitespace-pre-wrap break-words">{displayText}</p>}><ReadableQuestionPrompt prompt={displayText} /></Suspense>}
                                {chatEvents.explanations[item.id] && chatEvents.explanations[item.id] !== displayText ? <ChatMarkdown text={chatEvents.explanations[item.id]} /> : null}
                                {item.role === "flu" && item.modelUsed ? <small className="flu-message-model">Modelo usado: {item.modelUsed}</small> : null}
                                {item.refs?.sourceIds?.length ? <div className="flu-message-sources">{item.refs.sourceIds.map((sourceId) => { const source = sources.find((candidate) => candidate.id === sourceId); return source ? <button key={sourceId} type="button" onClick={() => openSource(source)} className="flu-message-source-card" aria-label={`Ver archivo original ${source.name}`}><SourceTypeIcon source={source} /><span>{source.name}</span><small>{source.status === "processing" ? "Procesando para Flu3nce · original disponible" : source.status === "failed" ? "No se pudo leer para Flu3nce · original disponible" : "Ver archivo original"}</small></button> : null; })}</div> : null}
                                {item.refs?.sourceIds?.length && item.failure ? <p className="flu-source-extraction-note">Flu3nce aún no puede usar el contenido de este archivo. Puedes abrir el original desde la tarjeta.</p> : null}
                                {item.generationStatus ? <p className="flu-chat-status mt-2 rounded-lg bg-[color:var(--fl-primary-subtle)] px-3 py-2 text-xs text-[color:var(--fl-link)]">{item.generationStatus.stepLabel}</p> : null}
                                {actionsCurrent && item.clarification?.suggestions?.length ? <div className="flu-chat-suggestions mt-3 flex flex-wrap gap-2">{item.clarification.suggestions.map((suggestion) => <button key={suggestion} type="button" disabled={busy || !canOperate || !session.freeMessagesEnabled} onClick={() => sendText(suggestion)} className="rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fl-link)] disabled:opacity-50">{suggestion}</button>)}</div> : null}
                                {item.answers?.answers.length ? <ul className="flu-chat-answers mt-2 space-y-1 rounded-lg bg-[color:var(--fl-surface-2)] p-3 text-xs text-[color:var(--fl-text-3)]">{item.answers.answers.map((answer) => <li key={answer.questionId}>{answer.display ?? String(answer.value)}</li>)}</ul> : null}
                                {actionsCurrent && item.questionGroup?.state === "open" && canOperate ? <ConsultationQuestions group={item.questionGroup} projectId={session.chat.projectId} onAnswer={async (answers) => { await answerChatQuestionGroup(chatId, item.questionGroup!.id, answers); await refreshChat(); }} /> : null}
                                {item.deliverableCard && !item.parts?.some((part) => part.kind === "deliverable_card") ? item.chainBlock ? <ChatDeliverableTile card={item.deliverableCard} onOpen={() => openPartDeliverable(item.deliverableCard!)} /> : (item as ChatMessage).unitId ? <ConsultationDeliverableCard card={item.deliverableCard} projectId={session.chat.projectId} unitId={(item as ChatMessage).unitId!} onOpenPanel={() => openDeliverable(item.deliverableCard!, (item as ChatMessage).unitId!)} /> : <ChatDeliverableTile card={item.deliverableCard} onOpen={() => openPartDeliverable(item.deliverableCard!)} /> : null}
                                {metadata?.failure && !item.failure && metadata.failure.message !== displayText ? <p className="flu-chat-failure" role="alert">{metadata.failure.message}</p> : null}
                                {metadata?.permissionsPending?.length || metadata?.failure?.action?.kind === "grant_permission" ? <ChatPermissions pending={metadata.permissionsPending} action={metadata.failure?.action} projectId={session.chat.projectId} canWrite={canOperate} /> : null}
                                {item.chainBlock?.jobId && verifiedJobs[item.chainBlock.jobId] ? <ChatJobDetails job={verifiedJobs[item.chainBlock.jobId]} projectId={session.chat.projectId} canWrite={canOperate} /> : null}
                                {item.failure && !item.refs?.sourceIds?.length ? <div className="flu-chat-failure mt-2 rounded-lg border border-[color:var(--fl-error-border)] bg-[color:var(--fl-error-bg)] px-3 py-2 text-xs text-[color:var(--fl-error-text)]"><p>{item.failure.message}</p>{actionsCurrent && item.failure.safeAction === "retry" && item.failure.retryIntentId && canOperate ? <button type="button" disabled={busy} onClick={() => confirm(item.failure!.retryIntentId!)} className="mt-2 rounded-lg border border-[color:var(--fl-error-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 font-semibold">Confirmar reintento</button> : null}</div> : null}
                                {actionsCurrent && intent?.state === "pending" ? <div className="flu-chat-proposal mt-3 rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] p-3 text-xs">
                                    <p className="font-bold text-[color:var(--fl-text)]">Acción propuesta · todavía no ejecutada</p>
                                    <p className="mt-1">{intentDestination(intent)}</p>
                                    {intent.destinations?.length ? <ul className="mt-2 space-y-1">{intent.destinations.map((destination, index) => <li key={`${destination.unitId ?? destination.newUnit?.name ?? "destino"}-${index}`} className="rounded-lg bg-[color:var(--fl-bg)] px-2 py-1.5">{destination.deliverableTypes.map(deliverableLabel).join(", ")} · {destination.newUnit?.name ?? "Destino existente"}</li>)}</ul> : intent.deliverableTypes.length ? <p className="mt-1">Entregables: {intent.deliverableTypes.map(deliverableLabel).join(", ")}</p> : null}
                                    {intent.deliverableId ? <p className="mt-1">Solo se cambiará el entregable seleccionado.</p> : null}
                                    {saves && intent.contextProposal ? <p className="mt-2 rounded-lg bg-[color:var(--fl-bg)] p-2 whitespace-pre-wrap">Dato a guardar: {intent.contextProposal.text}</p> : null}
                                    {revision ? <div className="mt-2 rounded-lg bg-[color:var(--fl-bg)] p-2"><p>{revision.executionScope === "targeted_change" ? "Cambio puntual" : "Regeneración completa"}: {revision.changeSummary}</p>{revision.executionScope === "targeted_change" && revision.preview ? <pre className="mt-2 whitespace-pre-wrap break-words font-sans">Vista previa exacta: {revision.preview}</pre> : null}</div> : null}
                                    {!supported ? <p className="mt-2 text-[color:var(--fl-warning-text)]">Esta versión aún no puede confirmar este tipo de intención.</p> : !ready ? <p className="mt-2 text-[color:var(--fl-error-text)]">La propuesta no identifica todo lo necesario para confirmarla de forma segura.</p> : null}
                                    {supported && canOperate ? <div className="mt-3 flex gap-2"><button type="button" disabled={busy || !ready} onClick={() => confirm(intent.id)} className="rounded-lg bg-[color:var(--fl-primary)] px-3 py-2 font-semibold text-white disabled:opacity-50">{saves ? "Guardar dato" : revises ? "Confirmar revisión" : "Confirmar generación"}</button><button type="button" disabled={busy} onClick={() => dismiss(intent.id)} className="rounded-lg border border-[color:var(--fl-border)] px-3 py-2">Descartar</button></div> : null}
                                </div> : null}
                                {activityGroup ? <SavedChatActivity group={activityGroup} title={activityGroup.jobId && item.deliverableCard?.version ? `Ya puedes consultar ${deliverableLabel(item.deliverableCard.deliverableType).toLocaleLowerCase("es-MX")}` : undefined} /> : null}
                                {item.chainBlock?.final ? <SavedChainActivity block={item.chainBlock} /> : null}
                                    {showReferences ? <ChatReference chatId={chatId} messageId={item.id} requestId={item.chainBlock?.requestId ?? metadata?.requestId} /> : null}
                            </article>;
                        })}

                        {orphanJobActivities.length ? <ChatActivity items={orphanJobActivities.map((item) => {
                            const state = verifiedJobs[item.jobId!]?.status ?? (stoppedJobs.has(item.jobId!) ? "cancelled" : undefined);
                            return state && ["running", "pending"].includes(item.state) ? { ...item, state } : item;
                        })} connection={chatEvents.connection} /> : null}
                        {activity && !visibleLiveTurn?.phaseB ? <div role="status" className="flu-thinking">{activity}<span aria-hidden="true" className="flu-thinking-dots"><i /><i /><i /></span></div> : null}
                        {visibleLiveTurn?.accepted && !visibleLiveTurn.userMessageId && !messages.some((message) => message.role === "user" && message.text === visibleLiveTurn.prompt && Date.parse(message.createdAt) >= visibleLiveTurn.startedAt) ? <article className="flu-message flu-user ml-auto px-4 py-3 text-sm">{visibleLiveTurn.prompt}</article> : null}
                        {visibleLiveTurn ? <ChatStreamResponse turn={visibleLiveTurn} showReferences={showReferences} onOpenDeliverable={openPartDeliverable} /> : null}
                    </div>
                </div>
                {showScrollBottom ? <button type="button" onClick={scrollToChatBottom} className={`flu-chat-scroll-bottom ${newReplyBelow ? "has-new-reply" : ""}`} aria-label={newReplyBelow ? "Nueva respuesta de Flu3nce: ir al final" : "Ir al final de la conversación"} title={newReplyBelow ? "Nueva respuesta de Flu3nce" : "Ir al final de la conversación"}><span aria-hidden="true">↓</span>{newReplyBelow ? <span className="flu-chat-scroll-unread" aria-hidden="true" /> : null}</button> : null}
                <div className="flu-composer-area shrink-0 px-4 py-4 sm:px-8">{visibleUploadBatches.map((record) => <ChatUploadBatch key={record.id} record={record} manager={uploadManager} />)}<ChatComposer id="flu-chat-message" submitDisabled={!!activeUploadBatch} uploadControl={activeUploadBatch ? () => void uploadManager.cancel(activeUploadBatch.id) : undefined} value={draft} onChange={setDraft} onSubmit={send} onAttach={() => sourceInput.current?.click()} onOpenLibrary={!isMockMode && !session.chat.unassigned ? () => { closePreview(); closeMemory(); setContextOpen(true); setOpenLibrarySignal((value) => value + 1); } : undefined} attachments={stagedFiles} onRemoveAttachment={(index) => setStagedFiles((items) => items.filter((_, position) => position !== index))} modelControls={modelControls} modelStatus={modelStatus} stopControl={canOperate && hasCapability(user, "task_controls") && ((visibleLiveTurn?.state === "running" && !!visibleLiveTurn.turnId) || liveJobs.length > 0) ? { requested: stoppingFlu, onStop: () => void stopFlu() } : undefined} disabled={!canOperate || !session.freeMessagesEnabled || busy} attachDisabled={!canOperate || busy || !hasCapability(user, "attachments_multiple")} label="Mensaje para Flu3nce" placeholder={!canWrite ? "Este chat está compartido contigo en modo lectura" : session.freeMessagesEnabled ? "Escribe lo que quieras explorar…" : "Los mensajes libres aún no están habilitados"} /></div>
            </> : <div aria-label="Cargando chat" aria-busy="true" className="flu-chat-loading flex-1 px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl space-y-5"><div className="flu-chat-skeleton ml-auto h-12 w-1/2 rounded-2xl" /><div className="flu-chat-skeleton h-20 w-3/4 rounded-2xl" /><div className="flu-chat-skeleton ml-auto h-12 w-2/3 rounded-2xl" /><span className="sr-only">Cargando conversación…</span></div></div>}
        </section>

        <aside id="flu-context" aria-label="Contexto del chat" aria-hidden={!contextVisible} inert={!contextVisible} className="flu-context shrink-0 p-5" style={{ "--flu-context-width": `${visibleContextWidth}px` } as CSSProperties}>
            {contextVisible ? <FluResizeHandle label="Ajustar ancho del contexto" value={visibleContextWidth} min={Math.min(280, maxContextWidth)} max={maxContextWidth} direction={-1} onChange={setContextWidth} /> : null}
            <div className="flu-context-scroll"><div className="flu-context-heading"><div><p className="flu-label">CONTEXTO DEL CHAT</p><h2>{session?.chat.unassigned || !projectId ? "Este chat" : selectedProject?.name ?? "Proyecto"}</h2></div><button type="button" aria-label="Plegar contexto" onClick={() => setContextOpen(false)}>›</button></div>
            <section className="flu-context-section"><div className="flex items-center justify-between"><h3>Fuentes</h3><span>{sources.length}{sourcesCursor ? "+" : ""}</span></div>{sourcesError ? <p role="alert" className="mt-2 text-xs text-[color:var(--fl-error-text)]">{sourcesError}</p> : null}{sources.length ? orderedSources.map((source) => <button key={source.id} type="button" onClick={() => openSource(source)} className="flu-context-item flu-context-source" title={`Ver archivo original ${source.name}`}><SourceTypeIcon source={source} /><span className="min-w-0"><span className="block truncate">{source.name}</span>{source.status === "processing" ? <span className="block text-[10px] text-[color:var(--fl-warning-text)]">Procesando contenido…</span> : source.status === "failed" ? <span className="block text-[10px] text-[color:var(--fl-error-text)]">No se pudo procesar el contenido</span> : null}</span></button>) : <p className="flu-context-empty">Todavía no hay fuentes añadidas.</p>}{sourcesCursor ? <button type="button" disabled={busy} onClick={() => void run(async () => { const page = await listChatSources(chatId, sourcesCursor); setSources((current) => [...current, ...page.sources.filter((next) => !current.some((item) => item.id === next.id))]); setSourcesCursor(page.nextCursor); }, "No se pudieron cargar más fuentes.")} className="flu-context-action">Ver más fuentes</button> : null}</section>
            {session && !isMockMode ? <FluSourceTools chatId={session.chat.id} projectId={session.chat.projectId} unassigned={session.chat.unassigned} canWrite={canWrite && (!selectedProject || selectedProject.rol !== "lector")} sources={orderedSources} openLibrarySignal={openLibrarySignal} onSourcesChanged={async () => { const page = await listChatSources(session.chat.id); setSources(page.sources); setSourcesCursor(page.nextCursor); await refreshChat(); }} /> : null}
            <section className="flu-context-section"><div className="flex items-center justify-between"><h3>Entregables</h3><span>{visibleDeliverables.length}</span></div>{visibleDeliverables.length ? visibleDeliverables.map((item) => item.unitId ? <button key={item.id} type="button" onClick={() => openDeliverable(item.deliverableCard!, item.unitId!)} className="flu-context-item flu-context-deliverable" aria-label={`Ver ${deliverableLabel(item.deliverableCard!.deliverableType)}, versión ${item.deliverableCard!.version?.number ?? "en curso"}`}><span className="flu-context-deliverable-icon"><DeliverableTypeIcon type={item.deliverableCard!.deliverableType} /></span><span className="flu-context-deliverable-title">{cardTitle(item.deliverableCard!)} · versión {item.deliverableCard!.version?.number ?? "en curso"}</span><span aria-hidden="true">→</span></button> : null) : <p className="flu-context-empty">Todavía no hay entregables. Puedes pedir el primero en el chat.</p>}</section>
            {session?.chat.unassigned && canWrite ? <button type="button" onClick={() => { setMoveOpen(true); setMovePreview(null); }} className="flu-context-action mt-5">Mover a proyecto</button> : null}
            {session && !session.chat.unassigned && canWrite ? <button type="button" disabled={busy || !canOperate} onClick={() => void run(async () => { const chat = await updateChat(chatId, { shared: !session.chat.shared }); setSession((current) => current ? { ...current, chat } : current); await refreshList(); }, "No se pudo cambiar la visibilidad.")} className="flu-context-action mt-5">{session.chat.shared ? "Volver privado" : "Compartir con el proyecto (solo lectura)"}</button> : null}
            {session && !session.chat.unassigned && selectedProject?.rol === "propietario" ? <button type="button" disabled={!canOperate} onClick={() => setMembersOpen(true)} className="flu-context-action mt-2">Gestionar miembros del proyecto</button> : null}
            </div>
        </aside>
        {(openedDeliverable || openedSource) && session ? <aside ref={deliverablePanel} aria-label={openedSource ? `Vista de ${openedSource.name}` : `Vista de ${cardTitle(openedDeliverable!.card)}`} className={`flu-deliverable-panel ${openedSource ? "is-source-panel" : ""} ${panelMaximized ? "is-maximized" : ""}`} style={{ "--flu-panel-width": `${visiblePanelWidth}px` } as CSSProperties}>
            {!panelMaximized ? <FluResizeHandle label="Ajustar ancho del panel de entregables" value={visiblePanelWidth} min={Math.min(360, maxPanelWidth)} max={maxPanelWidth} direction={-1} onChange={setPanelWidth} /> : null}
            <header className="flu-deliverable-panel-header"><div><p>{openedSource ? "ARCHIVO DEL CHAT" : "ENTREGABLE"}</p><h2 title={openedSource?.name}>{openedSource?.name ?? cardTitle(openedDeliverable!.card)}</h2></div><div className="flu-deliverable-panel-actions"><button type="button" onClick={() => setPanelMaximized((value) => !value)} aria-label={panelMaximized ? "Restaurar panel" : "Pantalla completa"} title={panelMaximized ? "Restaurar panel" : "Pantalla completa"}>{panelMaximized ? "⤢" : "⛶"}</button><button type="button" onClick={closePreview} aria-label="Cerrar panel">×</button></div></header>
            <div className="flu-deliverable-panel-content is-source-viewer">{openedSource ? <FluSourcePreview source={openedSource} projectId={session.chat.projectId} /> : openedDeliverable ? <ConsultationDeliverableCard key={`${openedDeliverable.card.deliverableId}-${openedDeliverable.card.version?.id ?? "pending"}`} card={openedDeliverable.card} projectId={session.chat.projectId} unitId={openedDeliverable.unitId} initiallyExpanded fullPreview /> : null}</div>
        </aside> : null}
        {moveOpen ? <div className="flu-move-backdrop"><section role="dialog" aria-modal="true" aria-label="Mover chat a proyecto" className="flu-move-dialog">
            <div className="flu-move-head"><div><p>MOVER CHAT</p><h2>Elige un proyecto</h2></div><button type="button" onClick={() => setMoveOpen(false)} aria-label="Cerrar">×</button></div>
            <p>El chat seguirá siendo privado. Sus archivos y entregables viajarán con él.</p>
            <select aria-label="Proyecto destino" value={moveProjectId} onChange={(event) => { setMoveProjectId(event.target.value); setMovePreview(null); }}><option value="">Elige proyecto</option>{projects.filter((item) => item.rol !== "lector").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            {projectsCursor ? <button type="button" disabled={busy} onClick={loadMoreProjects} className="flu-directory-more">Cargar más proyectos</button> : null}
            {movePreview ? <div className="flu-move-summary" role="status"><strong>Se moverán a {projects.find((project) => project.id === moveProjectId)?.name ?? "este proyecto"}:</strong><span>{itemCount(movePreview.messageCount, "mensaje", "mensajes")} · {itemCount(movePreview.sources.length, "archivo", "archivos")} · {itemCount(movePreview.deliverables.length, "entregable", "entregables")} · {itemCount(movePreview.contributions.length, "aporte", "aportes")}</span><small>El chat y sus versiones se mantienen; solo cambia el proyecto al que pertenecen.</small></div> : null}
            <div className="flu-move-actions"><button type="button" onClick={() => { setMoveOpen(false); setMovePreview(null); }}>Cancelar</button>{movePreview ? <button type="button" disabled={busy} onClick={executeMove}>Confirmar movimiento</button> : <button type="button" disabled={busy || !moveProjectId} onClick={previewMove}>Continuar</button>}</div>
        </section></div> : null}
        {projectCreateOpen ? <div className="flu-move-backdrop"><section role="dialog" aria-modal="true" aria-label="Crear proyecto" className="flu-move-dialog flu-project-create-dialog" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.preventDefault(); setProjectCreateOpen(false); } }}>
            <div className="flu-move-head"><div><p>NUEVO PROYECTO</p><h2>Crear proyecto</h2></div><button type="button" onClick={() => setProjectCreateOpen(false)} disabled={busy} aria-label="Cerrar">×</button></div>
            <p>Reúne chats relacionados sin compartir automáticamente los archivos de cada conversación.</p>
            <form onSubmit={(event) => { event.preventDefault(); void submitProject(); }}>
                <label htmlFor="flu-project-name">Nombre del proyecto</label>
                <input id="flu-project-name" autoFocus required maxLength={120} value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} placeholder="Ej. Compras menores" />
                <label htmlFor="flu-project-description">Descripción <span>(opcional)</span></label>
                <textarea id="flu-project-description" value={projectDescriptionDraft} onChange={(event) => setProjectDescriptionDraft(event.target.value)} rows={3} placeholder="¿Qué trabajo reunirás aquí?" />
                {projectCreateError ? <p role="alert" className="flu-project-create-error">{projectCreateError}</p> : null}
                <div className="flu-move-actions"><button type="button" disabled={busy} onClick={() => setProjectCreateOpen(false)}>Cancelar</button><button type="submit" disabled={busy || !projectNameDraft.trim()}>{busy ? "Creando…" : "Crear proyecto"}</button></div>
            </form>
        </section></div> : null}
        {memoryOpen ? <FluMemoryPanel onClose={closeMemory} /> : null}
        {session && selectedProject ? <CompartirModal open={membersOpen} projectId={session.chat.projectId} projectName={selectedProject.name} miRol={selectedProject.rol} onClose={() => setMembersOpen(false)} /> : null}
        {manualConfirmation ? <ManualVersionModal conflicts={manualConfirmation.conflicts} busy={busy} onCancel={() => setManualConfirmation(null)} onConfirm={() => confirm(manualConfirmation.intentId, true)} /> : null}
    </main>;
};
