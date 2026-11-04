import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { listMemories } from "@/services/v2/memories";

vi.mock("@/services/v2/memories", () => ({
    getMemorySettings: vi.fn().mockResolvedValue({ paused: false }),
    listMemories: vi.fn().mockResolvedValue({ memories: [] }),
    forgetMemory: vi.fn(),
    setMemoryPaused: vi.fn(),
}));

import { FluMemoryPanel } from "./flu-memory-panel";

describe("panel de memoria", () => {
    it("se muestra como panel lateral sin una capa que bloquee el chat", async () => {
        const onClose = vi.fn();
        const { container } = render(<MemoryRouter><FluMemoryPanel onClose={onClose} /></MemoryRouter>);
        expect(screen.getByRole("complementary", { name: "Memoria privada" })).toBeInTheDocument();
        expect(container.querySelector(".flu-deliverable-scrim")).not.toBeInTheDocument();
        expect(await screen.findByText("Aún no hay recuerdos guardados.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Cerrar memoria" }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("aclara el alcance del olvido antes de confirmarlo", async () => {
        vi.mocked(listMemories).mockResolvedValueOnce({ memories: [{ id: "mem_1", scope: "personal", text: "Frase de prueba", originChatId: "chat_1", originMessageId: "m_1", createdAt: "2026-10-24T00:00:00Z" }] });
        render(<MemoryRouter><FluMemoryPanel onClose={vi.fn()} /></MemoryRouter>);
        expect(await screen.findByText("Frase de prueba")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Olvidar" }));
        expect(screen.getByText(/no aparecerá en búsquedas desde otros chats/)).toBeInTheDocument();
        expect(screen.getByText(/seguirá en el historial de su chat de origen/)).toBeInTheDocument();
    });
});
