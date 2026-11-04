import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelChatTurn, chatFilesEnabled, confirmChatIntent, createChat, getChatMovePreview, getChatUpdates, listChats, listChatSources, mergeChatEventMessage, mergeChatUpdates, moveChat, orderChatSources, sendChatMessage, streamChatMessage, uploadChatSource, watchChatEvents } from "./chats";

const fetched = vi.fn();
vi.stubGlobal("fetch", fetched);

afterEach(() => fetched.mockReset());

describe("orden de incorporación de fuentes", () => {
    it("conserva el orden del lote y usa addedAt sin tratar una edición posterior como otro archivo subido", () => {
        const base = { projectId: "p1", name: "archivo.pdf", mime: "application/pdf", kind: "document" as const, status: "ready" as const, currentVersion: 1, createdAt: "2026-01-01T00:00:00Z" };
        const sources = [
            { ...base, id: "old", addedAt: "2026-01-01T00:00:00Z", updatedAt: "2026-11-02T00:00:00Z" },
            { ...base, id: "file2", addedAt: "2026-11-01T00:00:00Z", messageId: "m1", attachmentIndex: 1 },
            { ...base, id: "file1", addedAt: "2026-11-01T00:00:00Z", messageId: "m1", attachmentIndex: 0 },
        ];
        expect(orderChatSources(sources).map((source) => source.id)).toEqual(["file1", "file2", "old"]);
        expect(sources[0].id).toBe("old");
    });
});

function respond(body: unknown, status = 200) {
    fetched.mockResolvedValueOnce(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
}

describe("/chats QA adapter", () => {
    it("conserva los permisos y el fallo estructurado que llegan al terminar el stream", async () => {
        const pending = [{ sourceId: "s1", sourceName: "Audio.mp3", providers: ["openai"] }];
        const failure = { code: "source_not_permitted", message: "Falta permiso de OpenAI.", retryable: false, action: { kind: "grant_permission", sourceIds: ["s1"], providers: ["openai"] } };
        const message = { userMessage: { id: "u1" }, reply: { id: "m1", text: "Falta permiso." }, nucleo: { requestId: "r1" } };
        const body = `event: message\ndata: ${JSON.stringify(message)}\n\nevent: done\ndata: ${JSON.stringify({ replyId: "m1", outcome: "failed", failure, permissionsPending: pending })}\n\n`;
        fetched.mockResolvedValueOnce(new Response(body, { headers: { "Content-Type": "text/event-stream" } }));
        await expect(streamChatMessage("c1", "Analiza", "client1", {}, vi.fn())).resolves.toMatchObject({ outcome: "failed", failure, permissionsPending: pending, nucleo: { requestId: "r1" } });
        expect(fetched).toHaveBeenCalledOnce();
    });
    it("lista chats sueltos sin imponer un proyecto visible", async () => {
        respond({ chats: [] });
        await expect(listChats({ unassigned: true })).resolves.toEqual({ chats: [] });
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats?unassigned=true&limit=50");
    });

    it("permite pedir solo diez chats para la navegación", async () => {
        respond({ chats: [], nextCursor: "pagina_2" });
        await expect(listChats({ unassigned: true }, undefined, 10)).resolves.toEqual({ chats: [], nextCursor: "pagina_2" });
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats?unassigned=true&limit=10");
    });

    it("crea chat sin proyecto, sin unidad ni job", async () => {
        respond({ id: "chat_1", unassigned: true }, 201);
        await createChat("Compras menores");
        expect(fetched.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify({ title: "Compras menores" }) });
    });

    it("envía texto con idempotencia, sin llamar a confirmación", async () => {
        respond({ userMessage: { id: "m1" }, reply: { id: "m2" } }, 201);
        await sendChatMessage("chat_1", "sí", "client_1");
        expect(fetched).toHaveBeenCalledTimes(1);
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1/messages");
        expect(JSON.parse(fetched.mock.calls[0][1].body)).toEqual({ text: "sí", clientMessageId: "client_1" });
    });

    it("incluye el modelo y los adjuntos solo al elegirlos", async () => {
        respond({ userMessage: { id: "m1" }, reply: { id: "m2" } }, 201);
        await sendChatMessage("chat_1", "Compara", "client_2", { model: "gpt-5.4", attachmentIds: ["source_1"] });
        expect(JSON.parse(fetched.mock.calls[0][1].body)).toEqual({ text: "Compara", clientMessageId: "client_2", model: "gpt-5.4", attachmentIds: ["source_1"] });
    });

    it("detecta una ruta multipart apagada sin enviar archivos reales", async () => {
        respond({ code: "not_found", message: "No disponible" }, 404);
        await expect(chatFilesEnabled("chat_1")).resolves.toBe(false);
        expect(fetched.mock.calls[0][1]).toMatchObject({ method: "POST", body: expect.any(FormData) });
    });

    it("lee eventos SSE aunque un CRLF se divida entre fragmentos", async () => {
        const encoder = new TextEncoder();
        const chunks = [
            'event: text\r\ndata: {"index":0,"delta":"Hola"}\r',
            '\n\r\nevent: message\r\ndata: {"userMessage":{"id":"m1"},"reply":{"id":"m2","text":"Hola"}}\r\n\r\n',
            'event: done\r\ndata: {"replyId":"m2"}\r\n\r\n',
        ];
        const body = new ReadableStream<Uint8Array>({ start(controller) { chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk))); controller.close(); } });
        fetched.mockResolvedValueOnce(new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
        const onEvent = vi.fn();
        await expect(streamChatMessage("chat_1", "Hola", "client_3", { model: "gpt-5.4" }, onEvent)).resolves.toMatchObject({ reply: { text: "Hola" } });
        expect(onEvent.mock.calls.map(([event]) => event.event)).toEqual(["text", "message", "done"]);
        expect(JSON.parse(fetched.mock.calls[0][1].body)).toEqual({ text: "Hola", clientMessageId: "client_3", model: "gpt-5.4" });
    });

    it("sondea únicamente mensajes posteriores al último ID", async () => {
        respond({ chat: { id: "chat_1" }, messages: [] });
        await getChatUpdates("chat_1", "m_último");
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1?limit=200&since=m_%C3%BAltimo");
    });

    it("una cancelación termina el stream sin convertirla en error ni reenviar el mensaje", async () => {
        fetched.mockResolvedValueOnce(new Response('event: turn.start\ndata: {"turnId":"t1","seq":1}\n\nevent: cancelled\ndata: {"turnId":"t1","stoppedJobs":["j1"],"saved":[{"deliverableId":"d1","version":1}],"seq":2}\n\n', { headers: { "Content-Type": "text/event-stream" } }));
        await expect(streamChatMessage("c1", "Revisa", "client_1", {}, vi.fn())).resolves.toMatchObject({ cancelled: true, turnId: "t1", stoppedJobs: ["j1"], saved: [{ deliverableId: "d1", version: 1 }] });
        expect(fetched).toHaveBeenCalledOnce();
        respond({ effect: "cancelled", stoppedJobs: ["j1"] }, 202);
        await expect(cancelChatTurn("c1", "t1")).resolves.toMatchObject({ effect: "cancelled" });
        expect(fetched.mock.calls[1][0]).toBe("/api/v2/chats/c1/turns/t1/cancel");
        expect(fetched.mock.calls[1][1].method).toBe("POST");
    });

    it("recupera eventos con Last-Event-ID y conserva la posición de mensajes repetidos", async () => {
        fetched.mockResolvedValueOnce(new Response(': latido\n\nid: msg_2\nevent: message\ndata: {"id":"msg_2","text":"Ya está"}\n\n', { headers: { "Content-Type": "text/event-stream" } }));
        const receive = vi.fn(), heartbeat = vi.fn();
        await expect(watchChatEvents("c1", "msg_1", receive, new AbortController().signal, heartbeat)).resolves.toBe(true);
        expect(fetched.mock.calls[0][1].headers).toMatchObject({ "Last-Event-ID": "msg_1" });
        expect(receive).toHaveBeenCalledWith({ event: "message", id: "msg_2", data: { id: "msg_2", text: "Ya está" } });
        expect(heartbeat).toHaveBeenCalled();
        const chat = { id: "c1", projectId: "p1", title: "QA", shared: false, unassigned: false, access: "owner", createdAt: "", updatedAt: "" } as const;
        const first = { id: "m1", role: "user", kind: "text", text: "Hola", createdAt: "" } as const;
        const last = { ...first, id: "m2" };
        const merged = mergeChatEventMessage({ chat, messages: [last, first], freeMessagesEnabled: true }, { ...first, text: "Actualizado" });
        expect(merged.messages.map((item) => item.id)).toEqual(["m2", "m1"]);
    });

    it("combina novedades sin perder el cursor histórico ni recrear estado vacío", () => {
        const chat = { id: "chat_1", projectId: "project_1", title: "QA", shared: false, unassigned: false, access: "owner", createdAt: "2026-10-16T10:00:00Z", updatedAt: "2026-10-16T10:00:00Z" } as const;
        const first = { id: "m_1", role: "user", kind: "text", text: "Hola", createdAt: "2026-10-16T10:00:00Z" } as const;
        const current = { chat, messages: [first], nextCursor: "older_1", freeMessagesEnabled: true };
        expect(mergeChatUpdates(current, { chat, messages: [], freeMessagesEnabled: true })).toBe(current);
        const reply = { id: "m_2", role: "flu", kind: "text", text: "Hola", createdAt: "2026-10-16T10:00:01Z" } as const;
        const merged = mergeChatUpdates(current, { chat, messages: [reply], freeMessagesEnabled: true });
        expect(merged.messages.map((message) => message.id)).toEqual(["m_2", "m_1"]);
        expect(merged.nextCursor).toBe("older_1");
    });

    it("adjunta al chat, incluso si no tiene proyecto visible", async () => {
        respond({ id: "source_1", name: "fuente.txt" }, 201);
        await uploadChatSource("chat_1", new File(["QA"], "fuente.txt", { type: "text/plain" }));
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1/sources");
        expect(fetched.mock.calls[0][1].body).toBeInstanceOf(FormData);
    });

    it("consulta las fuentes del chat sin depender de una ruta de proyecto oculto", async () => {
        respond({ sources: [{ id: "source_1", name: "fuente.txt" }] });
        await listChatSources("chat_1");
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1/sources?limit=50");
    });

    it("continúa el listado de fuentes con el cursor opaco del contrato", async () => {
        respond({ sources: [{ id: "source_2", name: "segunda.pdf" }], nextCursor: "cursor_2" });
        await expect(listChatSources("chat_1", "cursor_1")).resolves.toMatchObject({ nextCursor: "cursor_2" });
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1/sources?limit=50&cursor=cursor_1");
    });

    it("confirma un intent solo mediante el endpoint explícito", async () => {
        respond({ jobId: "job_1" }, 202);
        await expect(confirmChatIntent("chat_1", "intent_1")).resolves.toEqual({ jobId: "job_1" });
        expect(fetched.mock.calls[0][0]).toBe("/api/v2/chats/chat_1/intents/intent_1/confirm");
    });

    it("mueve exactamente la vista previa elegida", async () => {
        respond({ previewId: "pv_1", chatId: "chat_1", toProjectId: "project_1", units: [], sources: [], deliverables: [], contributions: [], messageCount: 2 });
        const preview = await getChatMovePreview("chat_1", "project_1");
        respond({ id: "chat_1", projectId: "project_1", unassigned: false });
        await moveChat("chat_1", preview.toProjectId, preview.previewId);
        expect(JSON.parse(fetched.mock.calls[1][1].body)).toEqual({ projectId: "project_1", previewId: "pv_1" });
    });
});
