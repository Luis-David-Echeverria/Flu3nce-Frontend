import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router";
import { ArrowDown, Maximize01, Menu01, Minimize01 } from "@untitledui/icons";
import { ConsultationDeliverableCard, type Card } from "@/components/custom/consultation-deliverable-card";
import { CompartirModal } from "@/components/custom/compartir-modal";
import { ManualVersionModal } from "@/components/custom/manual-version-modal";
import { usePageTitle } from "@/hooks/use-page-title";
import { useAuth } from "@/hooks/use-auth";
import { useAuthContext } from "@/contexts/auth-context";
import { useTheme } from "@/providers/theme-provider";
import { useUploadBatches } from "@/hooks/use-upload-batches";
import { hasCapability } from "@/lib/capabilities";
import { useChatEvents } from "@/hooks/use-chat-events";
import { useChatLayout } from "@/hooks/use-chat-layout";
import { clearStoredDrafts, useChatDraft } from "@/hooks/use-chat-draft";
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
import { getDeliverable } from "@/services/v2/deliverables";
import { cancelJob, getJob } from "@/services/v2/jobs";
import { listAvailableModels, type ModelList } from "@/services/v2/models";
import type { ConsultationMessage, Job, Source } from "@/services/v2/types";
import { ChatJobActivity } from "./chat-job-activity";
import { ChatReference } from "./chat-reference";
import { ChatComposer } from "./chat-composer";
import { ChatUploadBatch } from "./chat-upload-batch";
import { ChatStreamResponse } from "./chat-stream-response";
import { ChatActivity, ChainWorkActivity } from "./chat-activity";
import { beginLiveTurn, reduceLiveTurn, type LiveTurn } from "./chat-stream-state";
import { buildChatTimeline } from "./chat-timeline";
import { collectChainBlocks } from "./chat-chain-state";
import { activityFromJob, isTerminalJob } from "./chat-job-state";
import { getMemorySettings } from "@/services/v2/memories";
import { FluMemoryPanel } from "./flu-memory-panel";
import { FluResizeHandle } from "./flu-resize-handle";
import { FluChatSidebar } from "./flu-chat-sidebar";
import { FluChatMessage, type ExchangeMetadata } from "./flu-chat-message";
import { FluCreateProjectDialog, FluMoveChatDialog } from "./flu-chat-dialogs";
import { FluChatContext } from "./flu-chat-context";
import { FluSourceTools } from "./flu-source-tools";
import { FluSourcePreview } from "./flu-source-preview";
import "./flu-chats.css";
import { ChatIcon, ContextIcon, DeliverableTypeIcon, EditIcon, FolderIcon } from "./flu-chats-icons";
import { WELCOME_CAPABILITIES } from "./flu-capabilities";
import { ChatUserError, ShownInTurnError, cardTitle, chatErrorForUser, type ChatMessage } from "./flu-chats-helpers";

/** Interfaz conversacional sobre el contrato real /chats. */
export const FluChatsPage = () => {
    usePageTitle("Chats de Flu3nce");
    const { logout } = useAuth();
    const { user } = useAuthContext();
    const { theme, setTheme } = useTheme();
    const [params, setParams] = useSearchParams();
    const { navOpen, setNavOpen, contextOpen, setContextOpen, navWidth, setNavWidth, setContextWidth, setPanelWidth, panelMaximized, setPanelMaximized, viewportWidth, maxContextWidth, visibleContextWidth, maxPanelWidth, visiblePanelWidth } = useChatLayout();
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
    const firstMessageScope = `new:${projectId || "sin-proyecto"}`;
    const { draft, setDraft, clearSent: clearSentDraft, restoreIfEmpty: restoreSentDraft } = useChatDraft(user?.userId, `chat:${chatId}`);
    const { draft: firstMessage, setDraft: setFirstMessage, clearSent: clearSentFirstMessage } = useChatDraft(user?.userId, firstMessageScope);
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
    const [exchangeMetadata, setExchangeMetadata] = useState<Record<string, ExchangeMetadata>>({});
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
            // Lo que ya se ve en la respuesta en curso (fallo o conexión interrumpida) no se repite arriba.
            if (!(caught instanceof ShownInTurnError)) setError(chatErrorForUser(caught, fallback));
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
        const jobIds = [...(exchange.reply.refs?.jobIds ?? []), exchange.reply.refs?.jobId ?? exchange.reply.intent?.jobId].filter((jobId): jobId is string => !!jobId);
        if (jobIds.length) setAnnouncedJobs((current) => new Set([...current, ...jobIds]));
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
                    if (event === "received") clearSentDraft(`chat:${targetChatId}`, prompt);
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
                const shown = liveTurnRef.current?.clientMessageId === id && (liveTurnRef.current.state === "interrupted" || (liveTurnRef.current.state === "failed" && !!liveTurnRef.current.failure));
                throw shown ? new ShownInTurnError(error instanceof Error ? error.message : "") : error;
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

    /** Escribe el inicio de una petición en el compositor de bienvenida, sin enviarla. */
    const startWith = (prompt: string) => {
        setFirstMessage(prompt);
        window.requestAnimationFrame(() => {
            const box = document.getElementById("flu-first-message");
            if (box instanceof HTMLTextAreaElement) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
        });
    };

    const startFromMessage = (text: string) => void run(async () => {
        const prompt = text.trim();
        const files = [...stagedFiles];
        const scope = firstMessageScope;
        if ((!prompt && !files.length) || !canStartInScope) return;
        if (files.length && !isMockMode && !prompt) throw new ChatUserError("Escribe qué quieres hacer con los archivos antes de enviarlos.");
        setActivity(files.length ? "Adjuntando archivos…" : "Analizando tu solicitud…");
        const title = prompt ? `${prompt.slice(0, 54)}${prompt.length > 54 ? "…" : ""}` : files[0].name.replace(/\.[^.]+$/, "").slice(0, 54) || "Nuevo chat";
        const chat = await createChat(title, projectId || undefined);
        setParams(projectId ? { project: projectId, chat: chat.id } : { chat: chat.id });
        await refreshList();
        try {
            await sendFilesAndPrompt(chat.id, files, prompt);
            clearSentFirstMessage(scope, prompt);
            setStagedFiles([]);

        } catch (caught) {
            restoreSentDraft(`chat:${chat.id}`, prompt);
            if (!(caught instanceof ShownInTurnError)) setError("El chat se creó, pero no se completó el envío. Revisa los archivos del chat antes de reintentar.");
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
        if (text.trim()) clearSentDraft(`chat:${chatId}`, text);

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
            let externalContinues = false;
            for (const id of ids) if (!stopped.has(id)) {
                try { const result = await cancelJob(id); if (result.effect === "cancelled_external_continues") externalContinues = true; }
                catch (error) {
                    if (error instanceof ApiServiceError && error.code === "job_control_via_parent" && typeof (error.detail as { parentJobId?: string })?.parentJobId === "string") {
                        const parent = (error.detail as { parentJobId: string }).parentJobId;
                        if (!stopped.has(parent)) { await cancelJob(parent); stopped.add(parent); }
                    } else if (!(error instanceof ApiServiceError && error.code === "job_not_cancellable")) throw error;
                }
            }
            setNotice(externalContinues ? "Flu3nce se detuvo. El servicio externo puede terminar su parte, pero el resultado no se va a publicar." : alreadyFinished && !ids.length ? "La respuesta ya había terminado." : saved ? `Flu3nce se detuvo. ${saved} ${saved === 1 ? "versión ya estaba guardada y se conserva" : "versiones ya estaban guardadas y se conservan"}.` : "Flu3nce se detuvo.");
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
        <FluChatSidebar
            navOpen={navOpen}
            navWidth={navWidth}
            onNavWidthChange={setNavWidth}
            onCloseBackdrop={() => setNavOpen(false)}
            onCollapse={() => { setNavOpen(false); window.requestAnimationFrame(() => navOpenButton.current?.focus()); }}
            closeButtonRef={navCloseButton}
            onNewChat={() => { setParams({}); setSession(null); setNavOpen(window.innerWidth > 760); }}
            chatSearch={chatSearch}
            onChatSearch={setChatSearch}
            chatId={chatId}
            projectId={projectId}
            looseChats={visibleLooseChats}
            loading={loading}
            unreadChats={unreadChats}
            onOpenChat={(chat, chatProjectId) => { setParams(chatProjectId ? { project: chatProjectId, chat: chat.id } : { chat: chat.id }); if (window.innerWidth <= 760) setNavOpen(false); }}
            onViewAll={(viewProjectId) => setParams(viewProjectId ? { view: "all", project: viewProjectId } : { view: "all" })}
            projects={sidebarProjects}
            projectChats={visibleProjectChats}
            hasMoreProjectChats={!!chatsCursor}
            expandedProjectId={expandedProjectId}
            onExpandProject={setExpandedProjectId}
            onOpenProject={openProject}
            onNewChatInProject={(newProjectId) => { setExpandedProjectId(newProjectId); setParams({ project: newProjectId }); setSession(null); if (window.innerWidth <= 760) setNavOpen(false); }}
            onCreateProject={openProjectCreation}
            account={{
                name: accountName,
                initial: accountInitial,
                email: user?.email,
                menuOpen: userMenuOpen,
                onToggleMenu: () => setUserMenuOpen((value) => !value),
                buttonRef: accountButton,
                menuRef: userMenu,
                theme,
                onTheme: setTheme,
                memoryAvailable,
                onOpenMemory: () => { setUserMenuOpen(false); closePreview(); setMemoryOpen(true); if (viewportWidth <= 760) setNavOpen(false); },
                showReferences,
                onToggleReferences: toggleReferences,
                onLogout: () => { clearStoredDrafts(user?.userId); void logout(); },
            }}
        />

        <section className="flu-main flex min-h-0 min-w-0 flex-1 flex-col" onDragEnter={(event) => { if (event.dataTransfer.types.includes("Files") && !directoryOpen) { event.preventDefault(); dragDepth.current++; setDraggingFiles(true); } }} onDragOver={(event) => { if (event.dataTransfer.types.includes("Files") && !directoryOpen) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; } }} onDragLeave={(event) => { if (event.dataTransfer.types.includes("Files")) { dragDepth.current = Math.max(0, dragDepth.current - 1); if (!dragDepth.current) setDraggingFiles(false); } }} onDrop={(event) => { if (!directoryOpen && event.dataTransfer.files.length) { event.preventDefault(); stageFiles(event.dataTransfer.files); } dragDepth.current = 0; setDraggingFiles(false); }}>
            {draggingFiles ? <div className="flu-chat-drop-overlay" aria-hidden="true">Suelta los archivos para añadirlos a la bandeja</div> : null}
            <header className="flu-topbar flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flu-breadcrumb">{!navOpen ? <button ref={navOpenButton} type="button" aria-label="Abrir navegación" onClick={() => { setNavOpen(true); window.requestAnimationFrame(() => navCloseButton.current?.focus()); }} className="flu-icon-button"><Menu01 aria-hidden="true" /></button> : null}<span>{selectedProject?.name ?? "Chats"}</span><span aria-hidden="true">›</span>{renamingChat ? <form className="flu-chat-rename-form" onSubmit={(event) => { event.preventDefault(); renameChat(); }} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setRenamingChat(false); } }}><input autoFocus aria-label="Nuevo nombre del chat" maxLength={120} value={chatTitleDraft} onChange={(event) => setChatTitleDraft(event.target.value)} /><button type="submit" disabled={busy || !chatTitleDraft.trim()}>Guardar</button><button type="button" onClick={() => setRenamingChat(false)}>Cancelar</button></form> : session && canWrite && !directoryOpen ? <button type="button" className="flu-chat-rename-trigger" aria-label="Renombrar chat" title="Renombrar chat" onClick={() => { setChatTitleDraft(session.chat.title); setRenamingChat(true); }}><span className="truncate">{session.chat.title}</span><EditIcon /></button> : <strong>{directoryOpen ? "Explorar" : session?.chat.title ?? "Nueva conversación"}</strong>}</div>
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
                    <h1>¿Qué quieres trabajar hoy?</h1>
                    <div className="flu-suggestions" role="group" aria-label="Lo que Flu3nce puede hacer contigo">{WELCOME_CAPABILITIES.map((capability) => <button key={capability.prompt} type="button" disabled={unavailable || !canStartInScope} onClick={() => startWith(capability.prompt)}>{capability.type ? <DeliverableTypeIcon type={capability.type} /> : <ChatIcon />}{capability.prompt}</button>)}</div>
                    <ChatComposer id="flu-first-message" value={firstMessage} onChange={setFirstMessage} onSubmit={() => startFromMessage(firstMessage)} onAttach={() => sourceInput.current?.click()} attachments={stagedFiles} onRemoveAttachment={(index) => setStagedFiles((items) => items.filter((_, position) => position !== index))} modelControls={modelControls} modelStatus={modelStatus} disabled={unavailable || !canStartInScope} sendBlocked={busy} attachDisabled={busy || unavailable || !canStartInScope || !hasCapability(user, "attachments_multiple")} label="Tu primer mensaje" submitLabel="Enviar primer mensaje" placeholder="Escribe lo que quieras explorar…" />
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
                            return <FluChatMessage
                                key={item.id}
                                item={item}
                                chatId={chatId}
                                projectId={session.chat.projectId}
                                actionsCurrent={messages.findIndex((message) => message.id === item.id) > lastUserMessageIndex}
                                metadata={exchangeMetadata[item.id]}
                                explanation={chatEvents.explanations[item.id]}
                                sources={sources}
                                freeMessagesEnabled={!!session.freeMessagesEnabled}
                                canOperate={canOperate}
                                canRevise={hasCapability(user, "revisions")}
                                busy={busy}
                                verifiedJob={item.chainBlock?.jobId ? verifiedJobs[item.chainBlock.jobId] : undefined}
                                showReferences={showReferences}
                                onOpenSource={openSource}
                                onOpenDeliverable={openDeliverable}
                                onOpenPartDeliverable={openPartDeliverable}
                                onSendText={sendText}
                                onConfirm={(intentId) => confirm(intentId)}
                                onDismiss={dismiss}
                                onAnswerQuestionGroup={async (groupId, answers) => { await answerChatQuestionGroup(chatId, groupId, answers); await refreshChat(); }}
                            />;
                        })}

                        {visibleLiveTurn?.accepted && !visibleLiveTurn.userMessageId && !messages.some((message) => message.role === "user" && message.text === visibleLiveTurn.prompt && Date.parse(message.createdAt) >= visibleLiveTurn.startedAt) ? <article className="flu-message flu-user ml-auto px-4 py-3 text-sm">{visibleLiveTurn.prompt}</article> : null}
                        {visibleLiveTurn ? <ChatStreamResponse turn={visibleLiveTurn} showReferences={showReferences} onOpenDeliverable={openPartDeliverable} /> : null}
                        {activity && !visibleLiveTurn?.phaseB ? <div role="status" className="flu-thinking">{activity}<span aria-hidden="true" className="flu-thinking-dots"><i /><i /><i /></span></div> : null}
                        {orphanJobActivities.length ? <ChatActivity items={orphanJobActivities.map((item) => {
                            const state = verifiedJobs[item.jobId!]?.status ?? (stoppedJobs.has(item.jobId!) ? "cancelled" : undefined);
                            return state && ["running", "pending"].includes(item.state) ? { ...item, state } : item;
                        })} connection={chatEvents.connection} /> : null}
                    </div>
                </div>
                {showScrollBottom ? <button type="button" onClick={scrollToChatBottom} className={`flu-chat-scroll-bottom ${newReplyBelow ? "has-new-reply" : ""}`} aria-label={newReplyBelow ? "Nueva respuesta de Flu3nce: ir al final" : "Ir al final de la conversación"} title={newReplyBelow ? "Nueva respuesta de Flu3nce" : "Ir al final de la conversación"}><ArrowDown aria-hidden="true" />{newReplyBelow ? <span className="flu-chat-scroll-unread" aria-hidden="true" /> : null}</button> : null}
                <div className="flu-composer-area shrink-0 px-4 py-4 sm:px-8">{visibleUploadBatches.map((record) => <ChatUploadBatch key={record.id} record={record} manager={uploadManager} />)}<ChatComposer id="flu-chat-message" submitDisabled={!!activeUploadBatch} uploadControl={activeUploadBatch ? () => void uploadManager.cancel(activeUploadBatch.id) : undefined} value={draft} onChange={setDraft} onSubmit={send} onAttach={() => sourceInput.current?.click()} onOpenLibrary={!isMockMode && !session.chat.unassigned ? () => { closePreview(); closeMemory(); setContextOpen(true); setOpenLibrarySignal((value) => value + 1); } : undefined} attachments={stagedFiles} onRemoveAttachment={(index) => setStagedFiles((items) => items.filter((_, position) => position !== index))} modelControls={modelControls} modelStatus={modelStatus} stopControl={canOperate && hasCapability(user, "task_controls") && ((visibleLiveTurn?.state === "running" && !!visibleLiveTurn.turnId) || liveJobs.length > 0) ? { requested: stoppingFlu, onStop: () => void stopFlu() } : undefined} disabled={!canOperate || !session.freeMessagesEnabled} sendBlocked={busy} attachDisabled={!canOperate || busy || !hasCapability(user, "attachments_multiple")} label="Mensaje para Flu3nce" placeholder={!canWrite ? "Este chat está compartido contigo en modo lectura" : session.freeMessagesEnabled ? "Escribe lo que quieras explorar…" : "Los mensajes libres aún no están habilitados"} /></div>
            </> : <div aria-label="Cargando chat" aria-busy="true" className="flu-chat-loading flex-1 px-4 py-8 sm:px-8"><div className="mx-auto max-w-3xl space-y-5"><div className="flu-chat-skeleton ml-auto h-12 w-1/2 rounded-2xl" /><div className="flu-chat-skeleton h-20 w-3/4 rounded-2xl" /><div className="flu-chat-skeleton ml-auto h-12 w-2/3 rounded-2xl" /><span className="sr-only">Cargando conversación…</span></div></div>}
        </section>

        <FluChatContext
            visible={contextVisible}
            width={visibleContextWidth}
            maxWidth={maxContextWidth}
            onWidthChange={setContextWidth}
            title={session?.chat.unassigned || !projectId ? "Este chat" : selectedProject?.name ?? "Proyecto"}
            onCollapse={() => setContextOpen(false)}
            sources={sources}
            orderedSources={orderedSources}
            hasMoreSources={!!sourcesCursor}
            sourcesError={sourcesError}
            onOpenSource={openSource}
            onLoadMoreSources={() => void run(async () => { const page = await listChatSources(chatId, sourcesCursor); setSources((current) => [...current, ...page.sources.filter((next) => !current.some((item) => item.id === next.id))]); setSourcesCursor(page.nextCursor); }, "No se pudieron cargar más fuentes.")}
            sourceTools={session && !isMockMode ? <FluSourceTools chatId={session.chat.id} projectId={session.chat.projectId} unassigned={session.chat.unassigned} canWrite={canWrite && (!selectedProject || selectedProject.rol !== "lector")} openLibrarySignal={openLibrarySignal} onSourcesChanged={async () => { const page = await listChatSources(session.chat.id); setSources(page.sources); setSourcesCursor(page.nextCursor); await refreshChat(); }} /> : null}
            deliverables={visibleDeliverables}
            onOpenDeliverable={openDeliverable}
            busy={busy}
            actions={<>
                {session?.chat.unassigned && canWrite ? <button type="button" onClick={() => { setMoveOpen(true); setMovePreview(null); }} className="flu-context-action mt-5">Mover a proyecto</button> : null}
                {session && !session.chat.unassigned && canWrite ? <button type="button" disabled={busy || !canOperate} onClick={() => void run(async () => { const chat = await updateChat(chatId, { shared: !session.chat.shared }); setSession((current) => current ? { ...current, chat } : current); await refreshList(); }, "No se pudo cambiar la visibilidad.")} className="flu-context-action mt-5">{session.chat.shared ? "Volver privado" : "Compartir con el proyecto (solo lectura)"}</button> : null}
                {session && !session.chat.unassigned && selectedProject?.rol === "propietario" ? <button type="button" disabled={!canOperate} onClick={() => setMembersOpen(true)} className="flu-context-action mt-2">Gestionar miembros del proyecto</button> : null}
            </>}
        />
        {(openedDeliverable || openedSource) && session ? <aside ref={deliverablePanel} aria-label={openedSource ? `Vista de ${openedSource.name}` : `Vista de ${cardTitle(openedDeliverable!.card)}`} className={`flu-deliverable-panel ${openedSource ? "is-source-panel" : ""} ${panelMaximized ? "is-maximized" : ""}`} style={{ "--flu-panel-width": `${visiblePanelWidth}px` } as CSSProperties}>
            {!panelMaximized ? <FluResizeHandle label="Ajustar ancho del panel de entregables" value={visiblePanelWidth} min={Math.min(360, maxPanelWidth)} max={maxPanelWidth} direction={-1} onChange={setPanelWidth} /> : null}
            <header className="flu-deliverable-panel-header"><div><p>{openedSource ? "ARCHIVO DEL CHAT" : "ENTREGABLE"}</p><h2 title={openedSource?.name}>{openedSource?.name ?? cardTitle(openedDeliverable!.card)}</h2></div><div className="flu-deliverable-panel-actions"><button type="button" onClick={() => setPanelMaximized((value) => !value)} aria-label={panelMaximized ? "Restaurar panel" : "Pantalla completa"} title={panelMaximized ? "Restaurar panel" : "Pantalla completa"}>{panelMaximized ? <Minimize01 aria-hidden="true" /> : <Maximize01 aria-hidden="true" />}</button><button type="button" onClick={closePreview} aria-label="Cerrar panel">×</button></div></header>
            <div className="flu-deliverable-panel-content is-source-viewer">{openedSource ? <FluSourcePreview source={openedSource} projectId={session.chat.projectId} /> : openedDeliverable ? <ConsultationDeliverableCard key={`${openedDeliverable.card.deliverableId}-${openedDeliverable.card.version?.id ?? "pending"}`} card={openedDeliverable.card} projectId={session.chat.projectId} unitId={openedDeliverable.unitId} initiallyExpanded fullPreview /> : null}</div>
        </aside> : null}
        {moveOpen ? <FluMoveChatDialog
            projects={projects}
            hasMoreProjects={!!projectsCursor}
            onLoadMoreProjects={loadMoreProjects}
            projectId={moveProjectId}
            onProjectChange={(nextProjectId) => { setMoveProjectId(nextProjectId); setMovePreview(null); }}
            preview={movePreview}
            busy={busy}
            onClose={() => setMoveOpen(false)}
            onCancel={() => { setMoveOpen(false); setMovePreview(null); }}
            onPreview={previewMove}
            onConfirm={executeMove}
        /> : null}
        {projectCreateOpen ? <FluCreateProjectDialog
            name={projectNameDraft}
            onNameChange={setProjectNameDraft}
            description={projectDescriptionDraft}
            onDescriptionChange={setProjectDescriptionDraft}
            error={projectCreateError}
            busy={busy}
            onClose={() => setProjectCreateOpen(false)}
            onSubmit={() => void submitProject()}
        /> : null}
        {memoryOpen ? <FluMemoryPanel onClose={closeMemory} /> : null}
        {session && selectedProject ? <CompartirModal open={membersOpen} projectId={session.chat.projectId} projectName={selectedProject.name} miRol={selectedProject.rol} onClose={() => setMembersOpen(false)} /> : null}
        {manualConfirmation ? <ManualVersionModal conflicts={manualConfirmation.conflicts} busy={busy} onCancel={() => setManualConfirmation(null)} onConfirm={() => confirm(manualConfirmation.intentId, true)} /> : null}
    </main>;
};
