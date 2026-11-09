import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfirmChatIntent, mockCreateChat, mockGetChat, mockGetChatMovePreview, mockListChatSources, mockListChats, mockMoveChat, mockSendChatMessage, mockUploadChatSource, MOCK_TOUR_CHAT_ID, MOCK_TOUR_PROJECT_ID } from "./chat-store";

afterEach(() => vi.useRealTimers());

describe("recorrido local de Flu3nce", () => {
    it("incluye una galería con fuente y tres entregables, sin propuestas pendientes", () => {
        expect(mockListChats({ projectId: MOCK_TOUR_PROJECT_ID }).chats.some((chat) => chat.id === MOCK_TOUR_CHAT_ID)).toBe(true);
        const tour = mockGetChat(MOCK_TOUR_CHAT_ID);
        expect(tour.messages.filter((message) => message.deliverableCard)).toHaveLength(3);
        expect(tour.pendingIntentIds).toEqual([]);
        expect(mockListChatSources(MOCK_TOUR_CHAT_ID).sources).toHaveLength(1);
    });

    it("pide contexto una vez y, con el contexto, lanza el trabajo sin propuesta", () => {
        const chat = mockCreateChat("Política de ejemplo");
        const first = mockSendChatMessage(chat.id, "Quiero una política", "client_mock_1");
        expect(first.reply.kind).toBe("clarification");
        const second = mockSendChatMessage(chat.id, "Aplica a todas las áreas; compras menores de $10,000 requieren aprobación de Dirección.", "client_mock_2");
        expect(second.reply.kind).toBe("text");
        expect(second.reply.intent).toBeUndefined();
        expect(second.reply.refs?.jobId).toBeTruthy();
        expect(mockGetChat(chat.id).pendingIntentIds).toEqual([]);
    });

    it("muestra cola, progreso, entregable y revisión sin pedir confirmación", async () => {
        vi.useFakeTimers();
        const chat = mockCreateChat("Compras");
        mockSendChatMessage(chat.id, "Quiero una política", "client_mock_4");
        mockSendChatMessage(chat.id, "Aplica a todas las áreas; compras menores de $10,000 requieren aprobación de Dirección.", "client_mock_5");
        expect(mockGetChat(chat.id).messages.some((message) => message.generationStatus?.phase === "queued")).toBe(true);
        await vi.runAllTimersAsync();
        const completed = mockGetChat(chat.id);
        expect(completed.messages.some((message) => message.generationStatus?.phase === "running")).toBe(true);
        expect(completed.messages.some((message) => message.generationStatus?.phase === "done")).toBe(true);
        expect(completed.messages.find((message) => message.deliverableCard)?.deliverableCard?.version?.number).toBe(1);
        const revision = mockSendChatMessage(chat.id, "Corrige la política: la aprobación debe ser de Finanzas", "client_mock_6").reply;
        expect(revision.intent).toBeUndefined();
        expect(revision.refs?.jobId).toBeTruthy();
        await vi.runAllTimersAsync();
        expect(mockGetChat(chat.id).messages.find((message) => message.deliverableCard)?.deliverableCard?.version?.number).toBe(2);
    });

    it("la presentación con Gamma sí pide confirmación, con su motivo", () => {
        const chat = mockCreateChat("Presentación");
        const reply = mockSendChatMessage(chat.id, "Haz una presentación del proceso de compras menores para Dirección con lo que tenemos en este chat.", "client_mock_7").reply;
        expect(reply.intent?.state).toBe("pending");
        expect(reply.intent?.reason).toBe("external_cost");
        expect("jobId" in mockConfirmChatIntent(chat.id, reply.intent!.id)).toBe(true);
    });

    it("adjunta un archivo al chat suelto y lo mueve con vista previa", () => {
        const chat = mockCreateChat("Adjuntos");
        const file = new File(["Caso de prueba"], "proceso.txt", { type: "text/plain" });
        mockUploadChatSource(chat.id, file);
        expect(mockListChatSources(chat.id).sources[0].name).toBe("proceso.txt");
        const preview = mockGetChatMovePreview(chat.id, MOCK_TOUR_PROJECT_ID);
        expect(preview.sources.map((source) => source.name)).toEqual(["proceso.txt"]);
        const moved = mockMoveChat(chat.id, MOCK_TOUR_PROJECT_ID, preview.previewId);
        expect(moved.unassigned).toBe(false);
        expect(moved.projectId).toBe(MOCK_TOUR_PROJECT_ID);
    });
});
