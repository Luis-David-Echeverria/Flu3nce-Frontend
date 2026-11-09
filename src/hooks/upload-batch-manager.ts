import * as api from "@/services/v2/upload-batches";
import { ApiServiceError } from "@/services/v2/http";

/** El mismo nombre aunque llegue en otra forma Unicode (macOS escribe los acentos descompuestos). */
export function sameFileName(a: string, b: string): boolean {
    return a.normalize("NFC") === b.normalize("NFC");
}

export const MAX_UPLOAD_BYTES = 3 * 1024 ** 3;
export type LocalUploadFile = { name: string; size: number; lastModified: number; mime: string; fingerprint?: string; cancelled?: boolean };
export type TransferState = { loaded?: number; error?: string; needsFile?: boolean };
export type PendingUploadBatch = {
    id: string; chatId: string; text: string; model?: string; createdAt: number;
    files: LocalUploadFile[]; batch?: api.UploadBatch; transfers: Record<string, TransferState>;
    error?: string; cancelRequested?: boolean;
};
const terminal = (state: string) => ["sent", "cancelled", "expired"].includes(state);
const fileKey = (id: string, index: number) => `${id}:${index}`;
const errorText = (error: unknown) => {
    if (error instanceof ApiServiceError) {
        if (error.code === "not_found") return "La subida por partes no está disponible para esta cuenta. Tus archivos siguen aquí para reintentar.";
        if (error.code === "source_too_large") return "Los archivos superan el límite del servidor. El máximo de este lote es 3 GB.";
        if (error.code === "model_not_available") return "El modelo elegido ya no está disponible. Cancela este envío y elige otro modelo.";
        if (error.code === "conflict") return "El estado del envío cambió. Actualiza o reintenta para continuar.";
        return "No se pudo continuar con la subida. Reintenta o cancela el envío.";
    }
    return "Se interrumpió la conexión. Puedes reanudar sin volver a subir las partes recibidas.";
};

export function validateUploadFiles(files: File[]) {
    if (!files.length || files.length > 10) throw new Error("Puedes enviar hasta 10 archivos en un mensaje.");
    if (files.some((file) => file.size > MAX_UPLOAD_BYTES) || files.reduce((sum, file) => sum + file.size, 0) > MAX_UPLOAD_BYTES) throw new Error("Puedes enviar hasta 3 GB de archivos por mensaje.");
    if (files.some((file) => file.name.length > 255)) throw new Error("El nombre de cada archivo debe tener como máximo 255 caracteres.");
}

/** Keeps transfers alive when changing chats. Persist metadata, never multi-GB blobs. */
export class UploadBatchManager {
    private records: PendingUploadBatch[] = [];
    private listeners = new Set<() => void>();
    private files = new Map<string, File>();
    private controllers = new Map<string, AbortController>();
    private running = new Set<string>();
    private opening = new Set<string>();
    private polling = new Set<string>();
    private timer?: ReturnType<typeof setInterval>;
    private active = false;
    constructor(private storageKey: string, private storage?: Pick<Storage, "getItem" | "setItem">) {}
    getSnapshot = () => this.records;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private find(id: string) { return this.records.find((record) => record.id === id); }
    private publish() {
        try { this.storage?.setItem(this.storageKey, JSON.stringify(this.records)); } catch { /* A storage quota never interrupts a live upload. */ }
        this.listeners.forEach((listener) => listener());
    }
    private update(id: string, change: (record: PendingUploadBatch) => PendingUploadBatch) {
        if (!this.find(id)) return;
        this.records = this.records.map((record) => record.id === id ? change(record) : record);
        this.publish();
    }
    connect = () => {
        this.active = true;
        if (!this.records.length) {
            try {
                const saved = JSON.parse(this.storage?.getItem(this.storageKey) || "[]");
                if (Array.isArray(saved)) this.records = saved.filter((record) => record && typeof record.id === "string" && typeof record.chatId === "string" && typeof record.text === "string" && Array.isArray(record.files) && Date.now() - record.createdAt < 24 * 60 * 60 * 1000).map((record: PendingUploadBatch) => ({ ...record, transfers: {} }));
            } catch { /* Ignore invalid local metadata. */ }
            this.publish();
        }
        for (const record of this.records) {
            if (record.cancelRequested) void this.cancel(record.id);
            else if (!record.batch) void this.open(record.id);
            else if (!terminal(record.batch.state)) record.files.forEach((file, index) => {
                if (file.cancelled && record.batch?.files[index]?.state !== "cancelled") void this.cancelFile(record.id, index);
            });
        }
        void this.poll();
        this.timer = setInterval(() => void this.poll(), 2000);
    };
    disconnect = () => {
        this.active = false;
        clearInterval(this.timer);
        for (const controller of this.controllers.values()) controller.abort();
    };
    start = (chatId: string, text: string, files: File[], model?: string) => {
        validateUploadFiles(files);
        if (!text.trim() || text.length > 4000) throw new Error("Escribe una solicitud de hasta 4000 caracteres para enviar estos archivos.");
        const id = crypto.randomUUID();
        files.forEach((file, index) => this.files.set(fileKey(id, index), file));
        this.records = [...this.records, { id, chatId, text, model, createdAt: Date.now(), files: files.map((file) => ({ name: file.name, size: file.size, lastModified: file.lastModified, mime: file.type })), transfers: {} }];
        this.publish();
        void this.open(id);
        return id;
    };
    private async open(id: string) {
        const record = this.find(id);
        if (!record || record.batch || this.opening.has(id) || !this.active) return;
        this.opening.add(id);
        this.update(id, (current) => ({ ...current, error: undefined }));
        try {
            const batch = await api.createUploadBatch(record.chatId, { text: record.text, clientMessageId: id, ...(record.model ? { model: record.model } : {}), files: record.files.map(({ name, size, mime }) => ({ name, size, mime })) });
            if (batch.files.length !== record.files.length || batch.files.some((file, index) => !sameFileName(file.name, record.files[index].name) || file.size !== record.files[index].size)) throw new ApiServiceError("El lote recibido no coincide con los archivos declarados");
            this.update(id, (current) => ({ ...current, batch }));
            if (this.find(id)?.cancelRequested) await this.cancel(id);
            else {
                for (let index = 0; index < record.files.length; index++) if (this.find(id)?.files[index].cancelled) await this.cancelFile(id, index);
                this.pump();
            }
        } catch (error) { this.update(id, (current) => ({ ...current, error: errorText(error) })); }
        finally { this.opening.delete(id); }
    }
    private pump() {
        if (!this.active) return;
        for (const record of this.records) {
            if (!record.batch || terminal(record.batch.state) || record.cancelRequested) continue;
            record.batch.files.forEach((upload, index) => {
                const key = fileKey(record.id, index);
                if (upload.state !== "uploading" || record.files[index]?.cancelled || record.transfers[upload.uploadId]?.error || this.running.has(key)) return;
                if (!this.files.has(key)) {
                    if (!record.transfers[upload.uploadId]?.needsFile) this.transfer(record.id, upload.uploadId, { needsFile: true });
                    return;
                }
                if (this.running.size < 2) { this.running.add(key); void this.transferFile(record.id, index).finally(() => { this.running.delete(key); this.pump(); }); }
            });
        }
    }
    private transfer(id: string, uploadId: string, value: TransferState) {
        this.update(id, (record) => ({ ...record, transfers: { ...record.transfers, [uploadId]: { ...record.transfers[uploadId], ...value } } }));
    }
    private updateUpload(id: string, upload: api.Upload) {
        this.update(id, (record) => ({ ...record, batch: record.batch ? { ...record.batch, files: record.batch.files.map((item) => item.uploadId === upload.uploadId ? upload : item) } : undefined }));
    }
    private async transferFile(id: string, index: number) {
        const key = fileKey(id, index), record = this.find(id), file = this.files.get(key), upload = record?.batch?.files[index];
        if (!record || !upload || !file) return;
        const controller = new AbortController();
        this.controllers.set(key, controller);
        const check = () => { if (controller.signal.aborted || !this.active || this.find(id)?.cancelRequested || this.find(id)?.files[index].cancelled) throw new DOMException("Cancelado", "AbortError"); };
        this.transfer(id, upload.uploadId, { error: undefined, needsFile: false });
        try {
            if (!record.files[index].fingerprint) {
                const fingerprint = await api.fileFingerprint(file);
                this.update(id, (current) => ({ ...current, files: current.files.map((item, position) => position === index ? { ...item, fingerprint } : item) }));
            }
            check();
            let current = await api.getUpload(record.chatId, upload.uploadId);
            check();
            if (current.state !== "uploading") { this.updateUpload(id, current); return; }
            if (current.partSize <= 0 || current.partSize > 64 * 1024 ** 2 || current.partCount !== Math.ceil(file.size / current.partSize)) throw new ApiServiceError("La configuración de partes no coincide con el archivo");
            const received = new Set(current.received);
            let loaded = [...received].reduce((sum, n) => sum + Math.min(current.partSize, Math.max(0, file.size - (n - 1) * current.partSize)), 0);
            for (let part = 1; part <= current.partCount; part++) {
                if (received.has(part)) continue;
                check();
                const chunk = file.slice((part - 1) * current.partSize, part * current.partSize);
                const digest = await api.sha256(chunk);
                check();
                for (let attempt = 0; ; attempt++) {
                    try { await api.uploadPart(record.chatId, upload.uploadId, part, chunk, digest, controller.signal, (bytes) => this.transfer(id, upload.uploadId, { loaded: Math.min(file.size, loaded + bytes) })); break; }
                    catch (error) {
                        check();
                        if (!(error instanceof TypeError) || attempt >= 2) throw error;
                        await new Promise<void>((resolve) => { const timer = setTimeout(resolve, (attempt + 1) * 700); controller.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true }); });
                    }
                }
                loaded += chunk.size;
                this.transfer(id, upload.uploadId, { loaded });
            }
            check();
            current = await api.completeUpload(record.chatId, upload.uploadId, controller.signal);
            this.updateUpload(id, current);
        } catch (error) {
            if (!(error instanceof DOMException && error.name === "AbortError")) this.transfer(id, upload.uploadId, { error: errorText(error) });
        } finally { if (this.controllers.get(key) === controller) this.controllers.delete(key); }
    }
    poll = async () => {
        if (!this.active) return;
        await Promise.all(this.records.filter((record) => record.batch && !terminal(record.batch.state)).map(async (record) => {
            if (this.polling.has(record.id)) return;
            this.polling.add(record.id);
            try {
                const batch = await api.getUploadBatch(record.chatId, record.batch!.batchId);
                if (!this.active) return;
                this.update(record.id, (current) => current.batch && terminal(current.batch.state) ? current : ({ ...current, batch: { ...batch, files: batch.files.map((file, index) => current.batch?.files[index]?.state === "cancelled" ? current.batch.files[index] : file) }, cancelRequested: terminal(batch.state) ? false : current.cancelRequested, error: current.cancelRequested && !terminal(batch.state) ? current.error : undefined }));
                if (terminal(batch.state)) record.files.forEach((_, index) => this.files.delete(fileKey(record.id, index)));
            } catch (error) { if (this.active) this.update(record.id, (current) => ({ ...current, error: errorText(error) })); }
            finally { this.polling.delete(record.id); }
        }));
        this.pump();
    };
    retry = async (id: string, index?: number, file?: File) => {
        const record = this.find(id);
        if (!record) return;
        if (record.cancelRequested) { await this.cancel(id); return; }
        if (index !== undefined && file) {
            const expected = record.files[index];
            if (!sameFileName(file.name, expected.name) || file.size !== expected.size || (expected.fingerprint && await api.fileFingerprint(file) !== expected.fingerprint)) throw new Error("Selecciona el mismo archivo que empezó a subir; el nombre o el contenido no coincide.");
            this.files.set(fileKey(id, index), file);
        }
        this.update(id, (current) => ({ ...current, error: undefined, transfers: index === undefined ? {} : { ...current.transfers, [current.batch?.files[index]?.uploadId ?? ""]: {} } }));
        if (!record.batch) await this.open(id);
        else { await this.poll(); this.pump(); }
    };
    cancelFile = async (id: string, index: number) => {
        const record = this.find(id);
        if (!record || (record.batch && terminal(record.batch.state))) return;
        this.controllers.get(fileKey(id, index))?.abort();
        this.files.delete(fileKey(id, index));
        this.update(id, (current) => ({ ...current, files: current.files.map((file, position) => position === index ? { ...file, cancelled: true } : file) }));
        const upload = record.batch?.files[index];
        if (!upload) return;
        try { await api.cancelUpload(record.chatId, upload.uploadId); this.updateUpload(id, { ...upload, state: "cancelled" }); }
        catch (error) { this.transfer(id, upload.uploadId, { error: "No se confirmó la cancelación. Vuelve a pulsar cancelar para reintentar." }); await this.poll(); }
    };
    cancel = async (id: string) => {
        const record = this.find(id);
        if (!record || (record.batch && terminal(record.batch.state))) return;
        this.update(id, (current) => ({ ...current, cancelRequested: true, error: undefined }));
        record.files.forEach((_, index) => this.controllers.get(fileKey(id, index))?.abort());
        if (!record.batch) { if (!this.opening.has(id)) await this.open(id); return; }
        try {
            await api.cancelUploadBatch(record.chatId, record.batch.batchId);
            this.update(id, (current) => ({ ...current, cancelRequested: false, batch: { ...current.batch!, state: "cancelled" } }));
            record.files.forEach((_, index) => this.files.delete(fileKey(id, index)));
        } catch (error) { this.update(id, (current) => ({ ...current, error: "La transferencia está detenida, pero falta confirmar la cancelación con el servidor. Reintenta." })); await this.poll(); }
    };
    dismiss = (id: string) => {
        const record = this.find(id);
        if (!record?.batch || !terminal(record.batch.state)) return;
        this.records = this.records.filter((item) => item.id !== id);
        this.publish();
    };
}
