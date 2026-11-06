import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConsultationMessage } from "@/services/v2/types";
import { ChatCopyMessage, messageCopyText } from "./chat-copy-message";

afterEach(() => vi.unstubAllGlobals());

const base = { id: "m2", createdAt: "2026-11-06T10:00:00Z", role: "flu", kind: "text", text: "" } as ConsultationMessage;

describe("copiar una respuesta", () => {
    it("usa el texto visible cuando el mensaje no trae partes", () => {
        expect(messageCopyText(base, "Los responsables son Compras y Finanzas.")).toBe("Los responsables son Compras y Finanzas.");
    });

    it("junta el texto y las tablas de las partes, sin la actividad", () => {
        const item = { ...base, parts: [
            { kind: "text", text: "Estos son los pasos:" },
            { kind: "table", table: { columns: ["Paso", "Área"], rows: [["Solicitar", "Compras"]] } },
            { kind: "activity_group", activityGroup: { jobId: "j1" } },
        ] } as unknown as ConsultationMessage;
        expect(messageCopyText(item, "")).toBe("Estos son los pasos:\n\n| Paso | Área |\n| --- | --- |\n| Solicitar | Compras |");
    });

    it("copia al portapapeles y avisa que se copió", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
        render(<ChatCopyMessage text="Respuesta completa" />);
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copiar respuesta" })); });
        expect(writeText).toHaveBeenCalledWith("Respuesta completa");
        expect(screen.getByRole("status")).toHaveTextContent("Respuesta copiada");
    });

    it("dice cómo seguir si el navegador no deja copiar", async () => {
        vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
        render(<ChatCopyMessage text="Respuesta" />);
        await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Copiar respuesta" })); });
        expect(screen.getByText("No se pudo copiar. Selecciona el texto y cópialo a mano.")).toBeInTheDocument();
    });
});
