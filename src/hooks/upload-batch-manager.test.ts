import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import * as api from "@/services/v2/upload-batches";
import { ApiServiceError } from "@/services/v2/http";
import { MAX_UPLOAD_BYTES, UploadBatchManager, validateUploadFiles } from "./upload-batch-manager";

vi.mock("@/services/v2/upload-batches", () => ({ createUploadBatch: vi.fn(), getUploadBatch: vi.fn(), getUpload: vi.fn(), completeUpload: vi.fn(), cancelUpload: vi.fn(), cancelUploadBatch: vi.fn(), uploadPart: vi.fn(), sha256: vi.fn().mockResolvedValue("a".repeat(64)), fileFingerprint: vi.fn().mockResolvedValue("fingerprint") }));
let manager: UploadBatchManager;
let remote: api.UploadBatch;

beforeEach(() => {
    vi.clearAllMocks();
    remote = { batchId: "batch", state: "open", files: [] };
    vi.mocked(api.createUploadBatch).mockImplementation(async (_chat, body) => {
        remote.files = body.files.map((file, index) => ({ uploadId: `upload${index}`, name: file.name, size: file.size, partSize: 3, partCount: Math.ceil(file.size / 3), received: [], state: "uploading" }));
        return structuredClone(remote);
    });
    vi.mocked(api.getUploadBatch).mockImplementation(async () => structuredClone(remote));
    vi.mocked(api.getUpload).mockImplementation(async (_chat, id) => structuredClone(remote.files.find((file) => file.uploadId === id)!));
    vi.mocked(api.uploadPart).mockImplementation(async (_chat, id, part) => { remote.files.find((file) => file.uploadId === id)!.received.push(part); });
    vi.mocked(api.completeUpload).mockImplementation(async (_chat, id) => { const file = remote.files.find((file) => file.uploadId === id)!; file.state = "verifying"; return structuredClone(file); });
    vi.mocked(api.cancelUpload).mockImplementation(async (_chat, id) => { remote.files.find((file) => file.uploadId === id)!.state = "cancelled"; });
    vi.mocked(api.cancelUploadBatch).mockImplementation(async () => { remote.state = "cancelled"; });
    manager = new UploadBatchManager("test");
    manager.connect();
});
afterEach(() => manager.disconnect());

describe("subida por partes con un solo prompt", () => {
    it("declara los archivos y el modelo una sola vez, sube partes pequeñas y cierra cada archivo", async () => {
        manager.start("chat", "Compara el audio con el PDF", [new File(["1234567"], "audio.mp3"), new File(["pdf"], "doc.pdf")], "gpt-5.4");
        await waitFor(() => expect(api.completeUpload).toHaveBeenCalledTimes(2));
        expect(api.createUploadBatch).toHaveBeenCalledOnce();
        expect(api.createUploadBatch).toHaveBeenCalledWith("chat", expect.objectContaining({ text: "Compara el audio con el PDF", model: "gpt-5.4", files: [expect.objectContaining({ name: "audio.mp3", size: 7 }), expect.objectContaining({ name: "doc.pdf", size: 3 })] }));
        expect(vi.mocked(api.uploadPart).mock.calls.filter((call) => call[1] === "upload0").map((call) => [call[2], call[3].size])).toEqual([[1, 3], [2, 3], [3, 1]]);
        expect(manager.getSnapshot()[0].batch?.state).toBe("open");
    });

    it("reanuda solo las partes que faltan sin duplicar el lote", async () => {
        vi.mocked(api.uploadPart).mockRejectedValueOnce(new ApiServiceError("interrumpido"));
        const id = manager.start("chat", "Resume", [new File(["1234567"], "doc.pdf")]);
        await waitFor(() => expect(manager.getSnapshot()[0].transfers.upload0?.error).toBeTruthy());
        remote.files[0].received = [1];
        vi.mocked(api.uploadPart).mockClear();
        await manager.retry(id, 0);
        await waitFor(() => expect(api.completeUpload).toHaveBeenCalledOnce());
        expect(vi.mocked(api.uploadPart).mock.calls.map((call) => call[2])).toEqual([2, 3]);
        expect(api.createUploadBatch).toHaveBeenCalledOnce();
    });

    it("cancela un archivo en vuelo sin cancelar el otro ni descartar el prompt", async () => {
        vi.mocked(api.uploadPart).mockImplementation((_chat, id, _part, _bytes, _digest, signal) => id === "upload0" ? new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelado", "AbortError")))) : Promise.resolve());
        const id = manager.start("chat", "Compara ambos", [new File(["audio"], "audio.mp3"), new File(["pdf"], "doc.pdf")]);
        await waitFor(() => expect(api.uploadPart).toHaveBeenCalled());
        await manager.cancelFile(id, 0);
        await waitFor(() => expect(api.completeUpload).toHaveBeenCalledWith("chat", "upload1", expect.any(AbortSignal)));
        expect(api.cancelUpload).toHaveBeenCalledWith("chat", "upload0");
        expect(api.cancelUploadBatch).not.toHaveBeenCalled();
        expect(manager.getSnapshot()[0].text).toBe("Compara ambos");
        expect(manager.getSnapshot()[0].batch?.files[0].state).toBe("cancelled");
    });

    it("cancelar todo aborta la transferencia y usa DELETE del lote", async () => {
        vi.mocked(api.uploadPart).mockImplementation((_chat, _id, _part, _bytes, _digest, signal) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("Cancelado", "AbortError")))));
        const id = manager.start("chat", "Resume", [new File(["12345"], "audio.mp3")]);
        await waitFor(() => expect(api.uploadPart).toHaveBeenCalled());
        await manager.cancel(id);
        expect(api.cancelUploadBatch).toHaveBeenCalledWith("chat", "batch");
        expect(manager.getSnapshot()[0].batch?.state).toBe("cancelled");
        expect(api.completeUpload).not.toHaveBeenCalled();
    });

    it("recupera un lote tras recargar y exige el archivo correcto antes de continuar", async () => {
        vi.mocked(api.uploadPart).mockRejectedValueOnce(new ApiServiceError("red"));
        const storage = { getItem: vi.fn(() => ""), setItem: vi.fn() };
        manager.disconnect(); manager = new UploadBatchManager("test", storage); manager.connect();
        const id = manager.start("chat", "Resume", [new File(["1234567"], "doc.pdf")]);
        await waitFor(() => expect(manager.getSnapshot()[0].transfers.upload0?.error).toBeTruthy());
        const saved = storage.setItem.mock.calls[storage.setItem.mock.calls.length - 1][1];
        manager.disconnect();
        remote.files[0].received = [1];
        manager = new UploadBatchManager("test", { getItem: () => saved, setItem: vi.fn() }); manager.connect();
        await waitFor(() => expect(manager.getSnapshot()[0].transfers.upload0?.needsFile).toBe(true));
        await expect(manager.retry(id, 0, new File(["bad"], "otro.pdf"))).rejects.toThrow("no coincide");
        vi.mocked(api.uploadPart).mockClear();
        await manager.retry(id, 0, new File(["1234567"], "doc.pdf"));
        await waitFor(() => expect(api.completeUpload).toHaveBeenCalledOnce());
        expect(vi.mocked(api.uploadPart).mock.calls.map((call) => call[2])).toEqual([2, 3]);
        expect(api.createUploadBatch).toHaveBeenCalledOnce();
    });

    it("no sustituye una ruta apagada por envíos independientes de texto y fuentes", async () => {
        vi.mocked(api.createUploadBatch).mockRejectedValue(new ApiServiceError("no existe", "not_found"));
        manager.start("chat", "Resume", [new File(["pdf"], "doc.pdf")]);
        await waitFor(() => expect(manager.getSnapshot()[0].error).toMatch(/no está disponible/));
        expect(api.uploadPart).not.toHaveBeenCalled();
        expect(manager.getSnapshot()[0].text).toBe("Resume");
    });

    it("rechaza el exceso de tamaño y de cantidad antes de crear el lote", () => {
        const file = new File(["x"], "grande.mp4"); Object.defineProperty(file, "size", { value: MAX_UPLOAD_BYTES + 1 });
        expect(() => validateUploadFiles([file])).toThrow(/3 GB/);
        expect(() => manager.start("chat", "Resume", Array.from({ length: 11 }, () => new File(["x"], "doc.pdf")))).toThrow(/10 archivos/);
        expect(api.createUploadBatch).not.toHaveBeenCalled();
    });
});
