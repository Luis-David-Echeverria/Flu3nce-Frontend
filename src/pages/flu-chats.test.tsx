import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiServiceError } from "@/services/v2/http";

const listProjects = vi.hoisted(() => vi.fn());
const listProjectsPage = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const createProject = vi.hoisted(() => vi.fn());
const listChats = vi.hoisted(() => vi.fn());
const getChat = vi.hoisted(() => vi.fn());
const createChat = vi.hoisted(() => vi.fn());
const sendChatMessage = vi.hoisted(() => vi.fn());
const sendChatMessageWithFiles = vi.hoisted(() => vi.fn());
const streamChatMessage = vi.hoisted(() => vi.fn());
const cancelChatTurn = vi.hoisted(() => vi.fn());
const getJob = vi.hoisted(() => vi.fn());
const chatFilesEnabled = vi.hoisted(() => vi.fn());
const confirmChatIntent = vi.hoisted(() => vi.fn());
const dismissChatIntent = vi.hoisted(() => vi.fn());
const uploadChatSource = vi.hoisted(() => vi.fn());
const listChatSources = vi.hoisted(() => vi.fn());
const getChatMovePreview = vi.hoisted(() => vi.fn());
const updateChat = vi.hoisted(() => vi.fn());
const setTheme = vi.hoisted(() => vi.fn());
const uploadManagerStart = vi.hoisted(() => vi.fn());
const uploadManager = vi.hoisted(() => ({ start: uploadManagerStart, dismiss: vi.fn(), cancel: vi.fn(), cancelFile: vi.fn(), retry: vi.fn() }));
vi.mock("@/hooks/use-upload-batches", () => ({ useUploadBatches: () => ({ batches: [], manager: uploadManager }) }));
vi.mock("@/hooks/use-chat-events", () => ({ useChatEvents: () => ({ activities: [], connection: "unavailable", explanations: {} }) }));

vi.mock("@/contexts/auth-context", () => ({ useAuthContext: () => ({ user: { userId: "qa_owner", displayName: "David QA", email: "qa@example.test" } }) }));
vi.mock("@/providers/theme-provider", () => ({ useTheme: () => ({ theme: "light", setTheme }) }));

vi.mock("@/services/v2/projects", () => ({ listProjects, listProjectsPage, getProject, createProject }));
vi.mock("@/services/v2/chats", async () => ({
    orderChatSources: (await vi.importActual<typeof import("@/services/v2/chats")>("@/services/v2/chats")).orderChatSources,
    listChats, getChat, createChat, sendChatMessage, sendChatMessageWithFiles, streamChatMessage, chatFilesEnabled, confirmChatIntent,
    dismissChatIntent, answerChatQuestionGroup: vi.fn(),
    getChatMovePreview, moveChat: vi.fn(), updateChat,
    listChatSources, uploadChatSource,
    cancelChatTurn,
    mergeChatEventMessage: (current: { messages: { id: string }[] }, message: { id: string }) => ({ ...current, messages: current.messages.some((item) => item.id === message.id) ? current.messages.map((item) => item.id === message.id ? message : item) : [message, ...current.messages] }),
}));
vi.mock("@/services/v2/models", () => ({ listAvailableModels: vi.fn().mockResolvedValue(null) }));
vi.mock("@/services/v2/jobs", () => ({ getJob, cancelJob: vi.fn() }));
vi.mock("@/components/custom/consultation-deliverable-card", () => ({ ConsultationDeliverableCard: () => null }));
vi.mock("@/components/custom/consultation-questions", () => ({ ConsultationQuestions: () => null }));
vi.mock("@/components/custom/compartir-modal", () => ({ CompartirModal: () => null }));

import { FluChatsPage } from "./flu-chats";

const chat = {
    id: "chat_1", projectId: "hidden_1", title: "Compras menores", shared: false,
    unassigned: true, access: "owner", createdAt: "2026-10-15T10:00:00Z", updatedAt: "2026-10-15T10:00:00Z",
};

beforeEach(() => {
    window.localStorage.removeItem("flu:show-reference-ids:qa_owner");
    getJob.mockResolvedValue({ id: "job_1", status: "running" });
    listProjects.mockResolvedValue([]);
    listProjectsPage.mockImplementation(async () => ({ projects: await listProjects() }));
    getProject.mockRejectedValue(new Error("No existe"));
    createProject.mockResolvedValue({ id: "project_new", name: "QA Compras", description: "Datos sintéticos", status: "active", rol: "propietario" });
    listChats.mockResolvedValue({ chats: [chat] });
    getChat.mockResolvedValue({ chat, messages: [], freeMessagesEnabled: true });
    createChat.mockResolvedValue(chat);
    sendChatMessage.mockResolvedValue({ userMessage: {}, reply: {} });
    sendChatMessageWithFiles.mockResolvedValue({ userMessage: {}, reply: {}, sources: [] });
    streamChatMessage.mockResolvedValue(null);
    cancelChatTurn.mockResolvedValue({ effect: "cancelled", stoppedJobs: [] });
    chatFilesEnabled.mockResolvedValue(false);
    confirmChatIntent.mockResolvedValue({ jobId: "job_1" });
    dismissChatIntent.mockResolvedValue(undefined);
    uploadChatSource.mockResolvedValue({ id: "source_1", name: "contexto.pdf", status: "ready" });
    listChatSources.mockResolvedValue({ sources: [] });
    updateChat.mockImplementation(async (_id: string, patch: { title?: string }) => ({ ...chat, ...patch }));
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("pantalla de chats QA", () => {
    it("conserva el nuevo borrador si falla el primer envío después de crear el chat", async () => {
        let failSend!: (reason: Error) => void;
        sendChatMessage.mockImplementationOnce(() => new Promise((_resolve, reject) => { failSend = reject; }));
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        const firstMessage = await screen.findByRole("textbox", { name: "Tu primer mensaje" });
        fireEvent.change(firstMessage, { target: { value: "Solicitud inicial" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        await waitFor(() => expect(sendChatMessage).toHaveBeenCalledOnce());
        const nextMessage = await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        expect(nextMessage).toBeEnabled();
        fireEvent.change(nextMessage, { target: { value: "Lo que escribí mientras respondía" } });
        await act(async () => { failSend(new Error("Red no disponible")); });
        expect(await screen.findByText(/El chat se creó, pero no se completó el envío/)).toBeInTheDocument();
        expect(nextMessage).toHaveValue("Lo que escribí mientras respondía");
    });
    it("reconstruye texto y entregables en orden desde la cadena guardada con una sola actividad final plegada", async () => {
        const base = { createdAt: "2026-11-02T12:00:00Z", role: "flu", kind: "text" };
        const block = (messageId: string, seq: number, kind: string, extra = {}) => ({ requestId: "request_1", blockId: `block_${messageId}`, messageId, seq, kind, final: false, ...extra });
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [
            { ...base, id: "final", text: "Los dos archivos están disponibles.", chainBlock: block("final", 7, "explanation", { final: true, state: "completed", activities: [{ activityId: "a1", label: "el diagrama", state: "done", stages: [{ stage: "render", label: "Generando archivo", kind: "generating_file", ms: 12000 }] }] }) },
            { ...base, id: "card2", text: "Presentación preparada", deliverableCard: { deliverableId: "d2", deliverableType: "presentation", outcome: "generated", version: { id: "v2", number: 1 } }, chainBlock: block("card2", 6, "deliverable", { jobId: "j2", deliverableId: "d2" }) },
            { ...base, id: "transition", text: "Ahora sigo con la presentación.", chainBlock: block("transition", 4, "transition") },
            { ...base, id: "card1", text: "Diagrama preparado", deliverableCard: { deliverableId: "d1", deliverableType: "diagram_as_is", outcome: "generated", version: { id: "v1", number: 1 } }, chainBlock: block("card1", 3, "deliverable", { jobId: "j1", deliverableId: "d1" }) },
            { ...base, id: "plan", text: "Voy a preparar los dos entregables.", chainBlock: block("plan", 1, "plan") },
        ] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("Los dos archivos están disponibles.");
        const text = screen.getByRole("log").textContent!;
        expect(text.indexOf("Voy a preparar")).toBeLessThan(text.indexOf("Diagrama preparado"));
        expect(text.indexOf("Diagrama preparado")).toBeLessThan(text.indexOf("Ahora sigo"));
        expect(text.indexOf("Ahora sigo")).toBeLessThan(text.indexOf("Presentación preparada"));
        expect(screen.getAllByLabelText("Actividad de Flu3nce")).toHaveLength(1);
        expect(screen.getByLabelText("Actividad de Flu3nce")).not.toHaveAttribute("open");
        expect(screen.queryByRole("button", { name: "Detener Flu3nce" })).not.toBeInTheDocument();
        expect(screen.queryByText("Solicitud completada")).not.toBeInTheDocument();
    });
    it("oculta los IDs por defecto y deja activarlos por cuenta", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{ id: "message_1", createdAt: "2026-10-15T10:00:00Z", role: "flu", kind: "text", text: "Revisé tus archivos." }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);

        expect(await screen.findByText("Revisé tus archivos.")).toBeInTheDocument();
        expect(screen.queryByLabelText("ID del chat")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Abrir cuenta de David QA" }));
        fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Mostrar IDs de prueba/ }));
        expect(screen.getByLabelText("ID del chat")).toHaveTextContent("chat_1");
        expect(screen.getByLabelText("ID del mensaje")).toHaveTextContent("message_1");
        expect(window.localStorage.getItem("flu:show-reference-ids:qa_owner")).toBe("true");
        fireEvent.click(screen.getByRole("menuitemcheckbox", { name: /Mostrar IDs de prueba/ }));
        expect(screen.queryByLabelText("ID del chat")).not.toBeInTheDocument();
    });

    it("detiene el turno desde el compositor aunque siga abierto el stream, sin repetir la solicitud", async () => {
        streamChatMessage.mockImplementationOnce(async (_chatId, _text, _clientId, _options, onEvent, signal: AbortSignal) => {
            onEvent({ event: "received", data: {} });
            onEvent({ event: "turn.start", data: { turnId: "turn_1", seq: 1 } });
            onEvent({ event: "part.start", data: { partId: "p1", kind: "text", index: 0, seq: 2 } });
            onEvent({ event: "text.block", data: { partId: "p1", markdown: "## Hallazgos del archivo", seq: 3 } });
            await new Promise<void>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelado", "AbortError")), { once: true }));
        });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        const textbox = await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        fireEvent.change(textbox, { target: { value: "Revisa el documento" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        expect(await screen.findByRole("heading", { name: "Hallazgos del archivo" })).toBeInTheDocument();
        const stop = screen.getByRole("button", { name: "Detener Flu3nce" });
        expect(stop).toBeEnabled();
        expect(screen.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
        fireEvent.click(stop);
        await waitFor(() => expect(cancelChatTurn).toHaveBeenCalledWith("chat_1", "turn_1"));
        expect(await screen.findByText("Flu3nce se detuvo.")).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole("button", { name: "Deteniendo Flu3nce" })).not.toBeInTheDocument());
        expect(streamChatMessage).toHaveBeenCalledOnce();
        expect(sendChatMessage).not.toHaveBeenCalled();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("conserva el texto si la única parte guardada es la actividad y la deja plegada antes de la respuesta", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{ id: "reply", createdAt: "2026-10-15T10:00:00Z", role: "flu", kind: "text", text: "Respuesta completa.", parts: [{ kind: "activity_group", activityGroup: { collapsed: true, items: [{ label: "Generando archivo", kind: "generating_file", state: "done", ms: 1500 }] } }] }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Respuesta completa.")).toBeInTheDocument();
        const activity = screen.getByLabelText("Actividad de Flu3nce");
        expect(activity).not.toHaveAttribute("open");
        expect(screen.getByRole("log").querySelector("article")).toContainElement(activity);
        expect(screen.getByRole("log")).toHaveTextContent("Respuesta completa.");
        expect(screen.queryByLabelText("ID del chat")).not.toBeInTheDocument();
    });

    it("no confunde la actividad rutinaria de una respuesta con un entregable terminado", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{ id: "reply", createdAt: "2026-10-15T10:00:00Z", role: "flu", kind: "text", text: "Todavía estoy revisando el proceso.", parts: [{ kind: "activity_group", activityGroup: { collapsed: true, items: [{ label: "Redactando la respuesta", kind: "model_call", state: "done", ms: 1500 }] } }] }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Todavía estoy revisando el proceso.")).toBeInTheDocument();
        expect(screen.queryByLabelText("Actividad de Flu3nce")).not.toBeInTheDocument();
        expect(screen.queryByText("Solicitud completada")).not.toBeInTheDocument();
    });

    it("retira el control de detener cuando el trabajo real ya terminó", async () => {
        getJob.mockResolvedValue({ id: "job_1", status: "done" });
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{ id: "status_1", role: "system", kind: "generation_status", text: "Preparando", createdAt: "2026-10-15T10:00:00Z", generationStatus: { jobId: "job_1", phase: "running", stepLabel: "Preparando" } }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await waitFor(() => expect(getJob).toHaveBeenCalledWith("job_1"));
        await waitFor(() => expect(screen.queryByRole("button", { name: "Detener Flu3nce" })).not.toBeInTheDocument());
        expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeInTheDocument();
    });

    it("concilia el error real sin anunciar éxito y retira el botón de detener", async () => {
        getJob.mockResolvedValue({ id: "job_1", status: "failed", error: { code: "output_invalid", message: "No se pudo construir el diagrama." } });
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{ id: "status_1", role: "system", kind: "generation_status", text: "Preparando", createdAt: "2026-10-15T10:00:00Z", generationStatus: { jobId: "job_1", phase: "running", stepLabel: "Preparando" } }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("No se pudo construir el diagrama.")).toBeInTheDocument();
        expect(screen.queryByText(/Ya puedes consultar/)).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Detener Flu3nce" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Enviar mensaje" })).toBeInTheDocument();
    });

    it("crea un proyecto con nombre y descripción desde el directorio y lo abre", async () => {
        render(<MemoryRouter initialEntries={["/flu?view=all"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
        const dialog = screen.getByRole("dialog", { name: "Crear proyecto" });
        fireEvent.change(within(dialog).getByRole("textbox", { name: "Nombre del proyecto" }), { target: { value: "  QA Compras  " } });
        fireEvent.change(within(dialog).getByRole("textbox", { name: /Descripción/ }), { target: { value: "  Datos sintéticos  " } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Crear proyecto" }));
        await waitFor(() => expect(createProject).toHaveBeenCalledWith("QA Compras", "Datos sintéticos"));
        expect(await screen.findByText("Proyecto creado. Ya puedes iniciar un chat dentro de él.")).toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "Crear proyecto" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Nuevo chat en QA Compras" })).toBeInTheDocument();
    });

    it("conserva el formulario si falla la creación del proyecto", async () => {
        createProject.mockRejectedValueOnce(new Error("detalle interno del servidor"));
        render(<MemoryRouter initialEntries={["/flu?view=all"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo proyecto" }));
        const dialog = screen.getByRole("dialog", { name: "Crear proyecto" });
        fireEvent.change(within(dialog).getByRole("textbox", { name: "Nombre del proyecto" }), { target: { value: "QA Compras" } });
        fireEvent.click(within(dialog).getByRole("button", { name: "Crear proyecto" }));
        expect(await within(dialog).findByRole("alert")).toHaveTextContent("No se pudo crear el proyecto.");
        expect(within(dialog).getByRole("textbox", { name: "Nombre del proyecto" })).toHaveValue("QA Compras");
        expect(screen.queryByText("detalle interno del servidor")).not.toBeInTheDocument();
    });

    it("ofrece todas las capacidades en la bienvenida y escribe la elegida sin enviarla", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("¿Qué quieres trabajar hoy?")).toBeInTheDocument();
        const capabilities = screen.getByRole("group", { name: "Lo que Flu3nce puede hacer contigo" });
        for (const name of ["Ayúdame a armar mi proceso", "Ayúdame a dibujar el diagrama de mi proceso", "Ayúdame a redactar una política", "Ayúdame a preparar una presentación", "Ayúdame a traducir un documento", "Ayúdame a transcribir una grabación"]) {
            expect(within(capabilities).getByRole("button", { name })).toBeInTheDocument();
        }
        expect(screen.queryByText("Elegir el nombre del chat")).not.toBeInTheDocument();
        fireEvent.click(within(capabilities).getByRole("button", { name: "Ayúdame a traducir un documento" }));
        expect(screen.getByRole("textbox", { name: "Tu primer mensaje" })).toHaveValue("Ayúdame a traducir un documento");
        expect(createChat).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        await waitFor(() => expect(createChat).toHaveBeenCalledWith("Ayúdame a traducir un documento", undefined));
    });

    it("muestra el botón de abrir navegación solo cuando la barra está plegada", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("¿Qué quieres trabajar hoy?");
        expect(screen.queryByRole("button", { name: "Abrir navegación" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Plegar navegación" }));
        expect(screen.getByRole("button", { name: "Abrir navegación" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Abrir navegación" }));
        expect(screen.queryByRole("button", { name: "Abrir navegación" })).not.toBeInTheDocument();
    });

    it("inicia con el contexto cerrado y lo abre solo al pedirlo", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("¿Qué quieres trabajar hoy?");
        const context = screen.getByLabelText("Contexto del chat");
        expect(context).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByRole("button", { name: "Contexto" })).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
        expect(context).toHaveAttribute("aria-hidden", "false");
    });

    it("permite iniciar desde un proyecto de la barra sin un control de QA en la interfaz", async () => {
        listProjects.mockResolvedValue([{ id: "project_qa", name: "QA Compras", status: "active", rol: "propietario" }]);
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo chat en QA Compras" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Tu primer mensaje" }), { target: { value: "Prepara una política" } });
        expect(screen.queryByRole("checkbox", { name: /datos sintéticos/ })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        await waitFor(() => expect(createChat).toHaveBeenCalledWith("Prepara una política", "project_qa"));
    });

    it("despliega y pliega las conversaciones de un proyecto desde la barra", async () => {
        listProjects.mockResolvedValue([{ id: "project_qa", name: "QA Compras", status: "active", rol: "propietario" }]);
        listChats.mockImplementation(async (scope: { projectId?: string }) => ({ chats: scope.projectId ? [{ ...chat, id: "chat_project", title: "Política de cobro", projectId: "project_qa", unassigned: false }] : [chat] }));
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        const toggle = await screen.findByRole("button", { name: "QA Compras" });
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(toggle);
        await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "true"));
        expect(await screen.findByRole("button", { name: "Política de cobro" })).toBeInTheDocument();
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("button", { name: "Política de cobro" })).not.toBeInTheDocument();
    });

    it("respeta el orden del historial del servidor aunque las marcas temporales empaten", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [
            { id: "reply", createdAt: "2026-10-15T10:00:00Z", role: "flu", kind: "text", text: "Te ayudo con ese PDF." },
            { id: "user", createdAt: "2026-10-15T10:00:00Z", role: "user", kind: "text", text: "¿De qué trata este PDF?" },
        ] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Te ayudo con ese PDF.")).toBeInTheDocument();
        const articles = screen.getByRole("log").querySelectorAll("article");
        expect(Array.from(articles, (item) => item.querySelector(".flu-markdown")?.textContent)).toEqual(["¿De qué trata este PDF?", "Te ayudo con ese PDF."]);
    });

    it("actualiza una sola tarjeta visual para la confirmación y los estados del mismo job", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [
            { id: "running", createdAt: "2026-10-15T10:04:00Z", role: "system", kind: "generation_status", text: "Estoy preparando el borrador.", generationStatus: { jobId: "job_1", target: "deliverable", phase: "running", stepLabel: "Preparando el borrador de política" } },
            { id: "ack", createdAt: "2026-10-15T10:03:00Z", role: "flu", kind: "text", text: "Confirmado: preparo el borrador de política." },
            { id: "queued", createdAt: "2026-10-15T10:02:00Z", role: "system", kind: "generation_status", text: "Recibí la petición.", generationStatus: { jobId: "job_1", target: "deliverable", phase: "queued", stepLabel: "En cola: borrador de política" } },
            { id: "intent", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm", text: "Propuesta confirmada.", intent: { id: "intent_1", state: "confirmed", jobId: "job_1", target: "deliverable", deliverableTypes: ["policy_draft"] } },
            { id: "user", createdAt: "2026-10-15T10:00:00Z", role: "user", kind: "text", text: "Prepara una política" },
        ] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByRole("status")).toHaveTextContent("Preparando el borrador de política");
        expect(screen.getByRole("log").querySelectorAll("article")).toHaveLength(2);
        expect(screen.queryByText("Propuesta confirmada.")).not.toBeInTheDocument();
        expect(screen.queryByText("Confirmado: preparo el borrador de política.")).not.toBeInTheDocument();
    });

    it("no muestra detalles internos del servidor si falla crear el chat", async () => {
        createChat.mockRejectedValueOnce(new ApiServiceError("Traceback: secret internal handler", "internal_error"));
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.change(screen.getByRole("textbox", { name: "Tu primer mensaje" }), { target: { value: "Hola" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar la conversación.");
        expect(screen.queryByText(/secret internal handler/)).not.toBeInTheDocument();
    });

    it("no expone errores inesperados de red o proveedor", async () => {
        createChat.mockRejectedValueOnce(new Error("POST /internal/chat-worker: token secret"));
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.change(screen.getByRole("textbox", { name: "Tu primer mensaje" }), { target: { value: "Hola" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo iniciar la conversación.");
        expect(screen.queryByText(/chat-worker/)).not.toBeInTheDocument();
    });

    it("inicia con un mensaje libre usando el backend real de chats", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.change(screen.getByRole("textbox", { name: "Tu primer mensaje" }), { target: { value: "Necesito una política de compras" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        await waitFor(() => expect(createChat).toHaveBeenCalledWith("Necesito una política de compras", undefined));
        await waitFor(() => expect(sendChatMessage).toHaveBeenCalledWith("chat_1", "Necesito una política de compras", expect.any(String)));
        expect(confirmChatIntent).not.toHaveBeenCalled();
    });

    it("mantiene el archivo en la bandeja y pide un prompt antes de abrir el lote", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("¿Qué quieres trabajar hoy?")).toBeInTheDocument();
        const file = new File(["contenido de prueba"], "contexto.pdf", { type: "application/pdf" });
        fireEvent.change(screen.getByLabelText("Seleccionar archivos para el chat"), { target: { files: [file] } });
        expect(screen.getByLabelText("Archivos pendientes de enviar")).toHaveTextContent("contexto.pdf");
        expect(createChat).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Enviar primer mensaje" }));
        expect(await screen.findByText(/Escribe qué quieres hacer con los archivos/)).toBeInTheDocument();
        expect(createChat).not.toHaveBeenCalled();
        expect(uploadManagerStart).not.toHaveBeenCalled();
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("abre un lote con varios adjuntos y el prompt; permite quitarlos antes de enviar", async () => {
        chatFilesEnabled.mockResolvedValue(true);
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        const first = new File(["uno"], "proceso.pdf", { type: "application/pdf" });
        const second = new File(["dos"], "audio.mp3", { type: "audio/mpeg" });
        const removed = new File(["tres"], "descartar.txt", { type: "text/plain" });
        fireEvent.change(screen.getByLabelText("Seleccionar archivos para el chat"), { target: { files: [first, second, removed] } });
        expect(uploadChatSource).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Quitar descartar.txt" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "Resume ambos archivos" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        await waitFor(() => expect(uploadManagerStart).toHaveBeenCalledWith("chat_1", "Resume ambos archivos", [first, second], undefined));
        expect(sendChatMessageWithFiles).not.toHaveBeenCalled();
        expect(uploadChatSource).not.toHaveBeenCalled();
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("conserva el texto y el archivo si el envío conjunto no está disponible", async () => {
        uploadManagerStart.mockImplementationOnce(() => { throw new Error("No se pudo enviar el mensaje junto con los archivos."); });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        const file = new File(["uno"], "proceso.pdf", { type: "application/pdf" });
        fireEvent.change(screen.getByLabelText("Seleccionar archivos para el chat"), { target: { files: [file] } });
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "Resume este PDF" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        expect(await screen.findByText(/No se pudo enviar el mensaje junto con los archivos/)).toBeInTheDocument();
        expect(screen.getByLabelText("Archivos pendientes de enviar")).toHaveTextContent("proceso.pdf");
        expect(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" })).toHaveValue("Resume este PDF");
        expect(uploadChatSource).not.toHaveBeenCalled();
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("añade a la bandeja un archivo arrastrado al chat sin subirlo todavía", async () => {
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        const area = document.querySelector(".flu-main")!;
        const file = new File(["contenido"], "arrastrado.pdf", { type: "application/pdf" });
        fireEvent.dragEnter(area, { dataTransfer: { types: ["Files"], files: [file] } });
        expect(screen.getByText("Suelta los archivos para añadirlos a la bandeja")).toBeInTheDocument();
        fireEvent.drop(area, { dataTransfer: { types: ["Files"], files: [file] } });
        expect(screen.getByLabelText("Archivos pendientes de enviar")).toHaveTextContent("arrastrado.pdf");
        expect(uploadChatSource).not.toHaveBeenCalled();
    });

    it("marca la respuesta que llegó a otro chat y la limpia al abrirlo", async () => {
        const other = { ...chat, id: "chat_2", title: "Otro chat" };
        listChats.mockResolvedValue({ chats: [chat, other] });
        getChat.mockImplementation(async (id: string) => id === "chat_2" ? {
            chat: { ...other, updatedAt: "2026-10-15T10:01:00Z" }, freeMessagesEnabled: true,
            messages: [{ id: "reply_2", createdAt: "2026-10-15T10:00:30Z", role: "flu", kind: "text", text: "Ya respondí." }],
        } : { chat, freeMessagesEnabled: true, messages: [] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("textbox", { name: "Mensaje para Flu3nce" });
        expect(screen.queryByTitle("Nueva respuesta de Flu3nce")).not.toBeInTheDocument();
        listChats.mockResolvedValue({ chats: [chat, { ...other, updatedAt: "2026-10-15T10:01:00Z" }] });
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "Hola" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        expect(await screen.findByTitle("Nueva respuesta de Flu3nce")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Otro chat/ }));
        await waitFor(() => expect(screen.queryByTitle("Nueva respuesta de Flu3nce")).not.toBeInTheDocument());
    });

    it("una propuesta sin motivo no se confirma: se marca como tarea no ejecutada", async () => {
        getChat.mockResolvedValue({
            chat, freeMessagesEnabled: true,
            messages: [{
                id: "m_1", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm",
                text: "Puedo preparar la política.",
                intent: { id: "intent_1", intentKind: "generate", target: "deliverable", deliverableTypes: ["policy_draft"], newUnit: { name: "Compras menores", kind: "policy" }, state: "pending" },
            }],
        });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Esta tarea no se ejecutó: quedó esperando una confirmación que ya no se usa.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Confirmar/ })).not.toBeInTheDocument();
        expect(screen.queryByText(/Acción propuesta/)).not.toBeInTheDocument();
    });

    it("la confirmación necesaria aparece al final, en espera, y un sí escrito no la ejecuta", async () => {
        getChat.mockResolvedValue({
            chat, freeMessagesEnabled: true,
            messages: [{
                id: "m_1", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm",
                text: "La presentación usa Gamma.",
                intent: { id: "intent_1", intentKind: "generate", target: "deliverable", deliverableTypes: ["presentation"], newUnit: { name: "Resumen", kind: "presentation" }, state: "pending", reason: "external_cost" },
            }],
        });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("En espera de tu confirmación")).toBeInTheDocument();
        expect(screen.getByText(/servicio externo con coste/)).toBeInTheDocument();
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "sí" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        await waitFor(() => expect(sendChatMessage).toHaveBeenCalledTimes(1));
        expect(confirmChatIntent).not.toHaveBeenCalled();
    });

    it("confirma una acción con motivo solo desde su botón", async () => {
        getChat.mockResolvedValue({
            chat, freeMessagesEnabled: true,
            messages: [{
                id: "m_1", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm",
                text: "La presentación usa Gamma.",
                intent: { id: "intent_1", intentKind: "generate", target: "deliverable", deliverableTypes: ["presentation"], newUnit: { name: "Resumen", kind: "presentation" }, state: "pending", reason: "external_cost" },
            }],
        });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "Confirmar y continuar" }));
        await waitFor(() => expect(confirmChatIntent).toHaveBeenCalledWith("chat_1", "intent_1", false));
    });

    it("muestra todos los destinos de una propuesta y confirma una sola intención", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "m_package", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm", text: "Preparo ambos entregables.",
            intent: {
                id: "intent_package", intentKind: "generate", target: "package", state: "pending", deliverableTypes: ["policy_draft"], newUnit: { name: "Política de cobro", kind: "policy" },
                destinations: [
                    { deliverableTypes: ["policy_draft"], newUnit: { name: "Política de cobro", kind: "policy" } },
                    { deliverableTypes: ["presentation"], newUnit: { name: "Presentación ejecutiva", kind: "presentation" } },
                ],
            },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText(/2 destinos propuestos para 2 entregables/)).toBeInTheDocument();
        expect(screen.getByText(/Política de cobro/)).toBeInTheDocument();
        expect(screen.getByText(/Presentación ejecutiva/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Confirmar y continuar" }));
        await waitFor(() => expect(confirmChatIntent).toHaveBeenCalledWith("chat_1", "intent_package", false));
    });

    it("descarta una propuesta pendiente antes de procesar un mensaje nuevo", async () => {
        const calls: string[] = [];
        dismissChatIntent.mockImplementation(async () => { calls.push("descartar"); });
        sendChatMessage.mockImplementation(async () => { calls.push("enviar"); return { userMessage: {}, reply: {} }; });
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, pendingIntentIds: ["intent_1"], messages: [{
            id: "m_1", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm",
            text: "Para ejecutarla, pulse el botón; escribir sí no la ejecuta.",
            intent: { id: "intent_1", intentKind: "generate", target: "deliverable", deliverableTypes: ["policy_draft"], newUnit: { name: "Cobro", kind: "policy" }, state: "pending" },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Esta tarea no se ejecutó: quedó esperando una confirmación que ya no se usa.")).toBeInTheDocument();
        expect(screen.queryByText(/escribir sí no la ejecuta/)).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "Antes, explícame la fuente" } });
        fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje" }));
        await waitFor(() => expect(calls).toEqual(["descartar", "enviar"]));
        expect(dismissChatIntent).toHaveBeenCalledWith("chat_1", "intent_1");
        expect(confirmChatIntent).not.toHaveBeenCalled();
    });

    it("manda una sugerencia de aclaración como mensaje, sin confirmar acciones", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "m_clarification", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "clarification",
            text: "¿Te refieres al borrador o al análisis?", clarification: { prompt: "¿Cuál necesitas?", suggestions: ["El borrador de la política"] },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "El borrador de la política" }));
        await waitFor(() => expect(sendChatMessage).toHaveBeenCalledWith("chat_1", "El borrador de la política", expect.any(String)));
        expect(confirmChatIntent).not.toHaveBeenCalled();
    });

    it("retira acciones de respuestas anteriores cuando el usuario continúa", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [
            { id: "next_user", createdAt: "2026-10-15T10:02:00Z", role: "user", kind: "text", text: "Sigamos con otra cosa" },
            { id: "old_reply", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "clarification", text: "¿Qué documento prefieres?", clarification: { prompt: "Elige", suggestions: ["Preparar un borrador"] } },
        ] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("¿Qué documento prefieres?")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Preparar un borrador" })).not.toBeInTheDocument();
    });

    it("no ofrece confirmar una propuesta anterior tras un mensaje nuevo", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [
            { id: "next_user", createdAt: "2026-10-15T10:02:00Z", role: "user", kind: "text", text: "Mejor explícame primero" },
            { id: "old_intent", createdAt: "2026-10-15T10:01:00Z", role: "flu", kind: "intent_to_confirm", text: "Propongo generar una política.", intent: { id: "intent_old", intentKind: "generate", target: "deliverable", deliverableTypes: ["policy_draft"], newUnit: { name: "Cobro", kind: "policy" }, state: "pending" } },
        ] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("Esta propuesta ya venció.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Confirmar generación" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Descartar" })).not.toBeInTheDocument();
    });

    it("permite ajustar la navegación con el teclado", async () => {
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("¿Qué quieres trabajar hoy?");
        const handle = screen.getByRole("separator", { name: "Ajustar ancho de navegación" });
        expect(handle).toHaveAttribute("aria-valuenow", "274");
        fireEvent.keyDown(handle, { key: "ArrowRight" });
        expect(handle).toHaveAttribute("aria-valuenow", "290");
    });

    it("concentra apariencia, memoria y salida en el avatar del usuario", async () => {
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("button", { name: "Renombrar chat" });
        expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Memoria" })).not.toBeInTheDocument();
        expect(screen.queryByText("1 fuente")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Abrir cuenta de David QA" }));
        expect(screen.getByRole("menuitemradio", { name: "Claro" })).toHaveAttribute("aria-checked", "true");
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Oscuro" }));
        expect(setTheme).toHaveBeenCalledWith("dark");
        fireEvent.click(screen.getByRole("menuitemradio", { name: "Sistema" }));
        expect(setTheme).toHaveBeenCalledWith("system");
        expect(screen.getByRole("menuitem", { name: /Memoria/ })).toBeInTheDocument();
        expect(screen.getByRole("menuitem", { name: /Cerrar sesión/ })).toBeInTheDocument();
    });

    it("renombra el chat desde su título y actualiza la cabecera", async () => {
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(await screen.findByRole("button", { name: "Renombrar chat" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Nuevo nombre del chat" }), { target: { value: "Política de compras" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => expect(updateChat).toHaveBeenCalledWith("chat_1", { title: "Política de compras" }));
        expect(await screen.findByRole("button", { name: "Renombrar chat" })).toHaveTextContent("Política de compras");
    });

    it("permite ajustar el contexto y distingue entregables con icono", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "result", createdAt: "2026-10-15T10:03:00Z", role: "flu", kind: "deliverable_ready", text: "Diagrama listo.", unitId: "unit_1",
            deliverableCard: { deliverableId: "del_1", deliverableType: "diagram_as_is", outcome: "generated", version: { id: "v1", number: 1 }, summary: "Listo." },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("Diagrama listo.");
        fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
        const handle = screen.getByRole("separator", { name: "Ajustar ancho del contexto" });
        expect(handle).toHaveAttribute("aria-valuenow", "330");
        fireEvent.keyDown(handle, { key: "ArrowLeft" });
        expect(handle).toHaveAttribute("aria-valuenow", "346");
        expect(screen.getByRole("button", { name: "Ver Diagrama As-Is, versión 1" }).querySelector("svg")).not.toBeNull();
    });

    it("permite ampliar el entregable y ocupar toda la aplicación", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "result", createdAt: "2026-10-15T10:03:00Z", role: "flu", kind: "deliverable_ready", text: "Aquí tienes tu política.", unitId: "unit_1",
            deliverableCard: { deliverableId: "del_1", deliverableType: "policy_draft", outcome: "generated", version: { id: "v1", number: 1 }, summary: "Lista." },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByText("Aquí tienes tu política.");
        fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
        fireEvent.click(screen.getByRole("button", { name: "Ver Política, versión 1" }));
        const panel = screen.getByRole("complementary", { name: /Vista de/ });
        expect(screen.getByRole("separator", { name: "Ajustar ancho del panel de entregables" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Pantalla completa" }));
        expect(panel).toHaveClass("is-maximized");
        fireEvent.click(screen.getByRole("button", { name: "Restaurar panel" }));
        expect(panel).not.toHaveClass("is-maximized");
    });

    it("expone un fallo técnico con su reintento, no como pregunta", async () => {
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "m_failed", createdAt: "2026-10-15T10:01:00Z", role: "system", kind: "technical_failure",
            text: "No se pudo generar el entregable.",
            failure: { code: "diagram_generation_invalid", message: "No se pudo producir un diagrama válido.", safeAction: "retry", retryIntentId: "intent_retry" },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByText("No se pudo producir un diagrama válido.")).toBeInTheDocument();
        expect(confirmChatIntent).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        await waitFor(() => expect(confirmChatIntent).toHaveBeenCalledWith("chat_1", "intent_retry", false));
    });

    it("deja el chat compartido en solo lectura para un lector", async () => {
        getChat.mockResolvedValue({ chat: { ...chat, access: "reader", shared: true, unassigned: false }, messages: [], freeMessagesEnabled: false });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        expect(await screen.findByPlaceholderText("Este chat está compartido contigo en modo lectura")).toBeDisabled();
        expect(screen.getByRole("button", { name: /Adjuntar archivos/ })).toBeDisabled();
    });

    it("permite acciones del propietario de un chat de proyecto", async () => {
        listProjects.mockResolvedValue([{ id: "project_qa", name: "QA Compras", status: "active", rol: "propietario" }]);
        getChat.mockResolvedValue({ chat: { ...chat, projectId: "project_qa", unassigned: false }, messages: [], freeMessagesEnabled: true });
        render(<MemoryRouter initialEntries={["/flu?project=project_qa&chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        const upload = await screen.findByRole("button", { name: /Adjuntar archivos/ });
        expect(upload).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
        expect(screen.getByRole("button", { name: "Compartir con el proyecto (solo lectura)" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Gestionar miembros del proyecto" })).toBeEnabled();
    });

    it("deja que Flu3nce elija la perspectiva sin controles de enfoque en el chat", async () => {
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        await screen.findByRole("log");
        for (const approach of ["Challenger", "Referentes", "Aclarar", "Oportunidades"]) {
            expect(screen.queryByRole("button", { name: approach })).not.toBeInTheDocument();
        }
        fireEvent.change(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" }), { target: { value: "Ayúdame a mejorar este proceso" } });
        expect(screen.getByRole("textbox", { name: "Mensaje para Flu3nce" })).toHaveValue("Ayúdame a mejorar este proceso");
        expect(sendChatMessage).not.toHaveBeenCalled();
    });

    it("muestra archivos originales en tarjetas y elimina el error repetido con el nombre largo", async () => {
        const source = { id: "source_1", projectId: "hidden_1", name: "reporte.pdf", mime: "application/pdf", kind: "document", status: "failed", currentVersion: 1 };
        listChatSources.mockResolvedValue({ sources: [source] });
        getChat.mockResolvedValue({ chat, freeMessagesEnabled: true, messages: [{
            id: "upload", role: "flu", kind: "text", createdAt: "2026-10-19T01:00:00Z",
            text: "Archivo añadido a este chat. No pude leer el texto de «reporte.pdf»: el chat no lee este formato.",
            refs: { sourceIds: ["source_1"] }, failure: { code: "source_read_failed", message: "No pude leer el texto de «reporte.pdf»." },
        }] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        const card = await screen.findByRole("button", { name: "Ver archivo original reporte.pdf" });
        expect(screen.queryByText(/No pude leer el texto de «reporte.pdf»/)).not.toBeInTheDocument();
        fireEvent.click(card);
        expect(screen.getByRole("button", { name: "Cerrar panel" })).toBeInTheDocument();
    });

    it("confirma el movimiento con contadores fuera del panel de contexto", async () => {
        listProjects.mockResolvedValue([{ id: "project_qa", name: "QA Compras", status: "active", rol: "propietario" }]);
        getChatMovePreview.mockResolvedValue({ chatId: "chat_1", toProjectId: "project_qa", previewId: "preview_1", messageCount: 4, sources: [{ sourceId: "source_1", name: "reporte.pdf" }], deliverables: [{ deliverableId: "deliverable_1" }], contributions: [], units: [] });
        render(<MemoryRouter initialEntries={["/flu?chat=chat_1"]}><FluChatsPage /></MemoryRouter>);
        fireEvent.click(screen.getByRole("button", { name: "Contexto" }));
        fireEvent.click(await screen.findByRole("button", { name: "Mover a proyecto" }));
        fireEvent.change(screen.getByRole("combobox", { name: "Proyecto destino" }), { target: { value: "project_qa" } });
        fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
        expect(await screen.findByText("4 mensajes · 1 archivo · 1 entregable · 0 aportes")).toBeInTheDocument();
        expect(getChatMovePreview).toHaveBeenCalledWith("chat_1", "project_qa");
        expect(screen.queryByText("Ver qué se moverá")).not.toBeInTheDocument();
    });

    it("carga diez chats y proyectos en la barra; el resto queda en el directorio paginado", async () => {
        const allChats = Array.from({ length: 12 }, (_, index) => ({ ...chat, id: `chat_${index + 1}`, title: `Chat ${index + 1}` }));
        const allProjects = Array.from({ length: 12 }, (_, index) => ({ id: `project_${index + 1}`, name: `Proyecto ${index + 1}`, status: "active", rol: "propietario" }));
        listChats.mockImplementation(async (_scope: unknown, cursor?: string) => ({ chats: cursor ? allChats.slice(10) : allChats.slice(0, 10), nextCursor: cursor ? undefined : "next" }));
        listProjectsPage.mockImplementation(async (_limit?: number, cursor?: string) => ({ projects: cursor ? allProjects.slice(10) : allProjects.slice(0, 10), nextCursor: cursor ? undefined : "next" }));
        render(<MemoryRouter initialEntries={["/flu"]}><FluChatsPage /></MemoryRouter>);
        const navigation = await screen.findByLabelText("Navegación de chats");
        await waitFor(() => expect(within(navigation).getAllByRole("button", { name: /^Chat \d+$/ })).toHaveLength(10));
        expect(within(navigation).getAllByRole("button", { name: /^Proyecto \d+$/ })).toHaveLength(10);
        fireEvent.click(within(navigation).getByRole("button", { name: "Ver todos los chats" }));
        fireEvent.click(screen.getByRole("button", { name: "Cargar más chats" }));
        expect(await screen.findByRole("button", { name: "Chat 12" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cargar más proyectos" }));
        expect(await screen.findByRole("button", { name: "Proyecto 12" })).toBeInTheDocument();
    });
});
