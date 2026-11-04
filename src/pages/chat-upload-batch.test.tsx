import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatUploadBatch } from "./chat-upload-batch";
import { UploadBatchManager, type PendingUploadBatch } from "@/hooks/upload-batch-manager";
afterEach(cleanup);

describe("bandeja de subida por partes", () => {
    it("muestra avance real y permite quitar un archivo sin publicar el borrador del mensaje", () => {
        const manager = new UploadBatchManager("test");
        const cancel = vi.spyOn(manager, "cancelFile").mockResolvedValue(undefined);
        const record: PendingUploadBatch = { id: "local1", chatId: "c1", text: "Prompt que todavía no se envía", createdAt: 0, files: [{ name: "Audio largo de compras.mp3", size: 100, mime: "audio/mpeg", lastModified: 0 }], transfers: { u1: { loaded: 30 } }, batch: { batchId: "batch1", state: "open", files: [{ uploadId: "u1", name: "Audio largo de compras.mp3", size: 100, state: "uploading", received: [], partSize: 10, partCount: 10 }] } };
        render(<ChatUploadBatch record={record} manager={manager} />);
        expect(screen.queryByText(record.text)).not.toBeInTheDocument();
        expect(screen.queryByText("Pendiente de enviar")).not.toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "30");
        expect(screen.queryByRole("button", { name: "Cancelar envío" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: `Cancelar subida de ${record.files[0].name}` }));
        expect(cancel).toHaveBeenCalledWith("local1", 0);
    });
});
