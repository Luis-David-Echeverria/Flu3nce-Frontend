import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatReference } from "./chat-reference";

afterEach(() => vi.restoreAllMocks());

describe("referencias para reportar errores", () => {
    it("muestra el ID completo del chat y lo copia", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<ChatReference chatId="43696b32-f363-4671-b31b-f21d8d4215aa" />);

        expect(screen.getByText("43696b32-f363-4671-b31b-f21d8d4215aa")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Copiar ID del chat" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith("Chat: 43696b32-f363-4671-b31b-f21d8d4215aa"));
        expect(screen.getByText("Copiado")).toBeInTheDocument();
    });

    it("copia juntos los IDs del chat, mensaje y trabajo", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<ChatReference chatId="chat_1" messageId="message_2" jobId="job_3" />);

        expect(screen.getByText("message_2")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Copiar ID del chat y del mensaje" }));
        await waitFor(() => expect(writeText).toHaveBeenCalledWith("Chat: chat_1\nMensaje: message_2\nTrabajo: job_3"));
    });
});
