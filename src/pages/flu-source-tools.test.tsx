import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiServiceError } from "@/services/v2/http";

const library = vi.hoisted(() => ({ listChatLibrary: vi.fn(), attachLibrarySource: vi.fn(), detachLibrarySource: vi.fn() }));
const sources = vi.hoisted(() => ({ uploadSource: vi.fn() }));
vi.mock("@/services/v2/chat-library", () => library);
vi.mock("@/services/v2/sources", () => sources);
import { FluSourceTools } from "./flu-source-tools";

const source = { id: "source_1", projectId: "project_1", name: "Manual.pdf", mime: "application/pdf", status: "ready" as const, currentVersion: 1, createdAt: "2026-10-17T10:00:00Z" };
beforeEach(() => {
    library.listChatLibrary.mockResolvedValue({ sources: [{ ...source, attached: false }] });
    library.attachLibrarySource.mockResolvedValue(undefined);
    library.detachLibrarySource.mockResolvedValue(undefined);
    sources.uploadSource.mockResolvedValue(source);
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("fuentes del chat", () => {
    it("adjunta de la biblioteca sin gestionar permisos por proveedor", async () => {
        const onSourcesChanged = vi.fn().mockResolvedValue(undefined);
        render(<FluSourceTools chatId="chat_1" projectId="project_1" unassigned={false} canWrite onSourcesChanged={onSourcesChanged} />);
        fireEvent.click(await screen.findByRole("button", { name: /Biblioteca del proyecto/ }));
        fireEvent.click(screen.getByRole("button", { name: "Adjuntar" }));
        await waitFor(() => expect(library.attachLibrarySource).toHaveBeenCalledWith("chat_1", "source_1"));
        await waitFor(() => expect(onSourcesChanged).toHaveBeenCalled());
        expect(screen.queryByText("Permisos de archivos")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Permitir" })).not.toBeInTheDocument();
    });

    it("mantiene visibles los accesos cuando el backend aún no los habilita", async () => {
        library.listChatLibrary.mockRejectedValue(new ApiServiceError("No disponible", "library_not_available"));
        render(<FluSourceTools chatId="chat_1" projectId="project_1" unassigned={false} canWrite onSourcesChanged={vi.fn()} />);
        await waitFor(() => expect(library.listChatLibrary).toHaveBeenCalled());
        fireEvent.click(screen.getByRole("button", { name: /Biblioteca del proyecto/ }));
        expect(await screen.findByText(/biblioteca aún no está habilitada/)).toBeInTheDocument();
    });

    it("abre la biblioteca desde el compositor y agrega archivos del equipo", async () => {
        const { rerender } = render(<FluSourceTools chatId="chat_1" projectId="project_1" unassigned={false} canWrite onSourcesChanged={vi.fn()} />);
        rerender(<FluSourceTools chatId="chat_1" projectId="project_1" unassigned={false} canWrite onSourcesChanged={vi.fn()} openLibrarySignal={1} />);
        expect(screen.getByRole("button", { name: /Biblioteca del proyecto/ })).toHaveAttribute("aria-expanded", "true");
        fireEvent.change(await screen.findByLabelText("Archivos para la biblioteca"), { target: { files: [new File(["datos"], "datos.pdf", { type: "application/pdf" })] } });
        await waitFor(() => expect(sources.uploadSource).toHaveBeenCalledWith("project_1", expect.objectContaining({ name: "datos.pdf" })));
        await waitFor(() => expect(library.listChatLibrary).toHaveBeenCalledTimes(2));
    });
});
