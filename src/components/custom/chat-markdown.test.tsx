import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./chat-markdown";

describe("formato de mensajes del chat", () => {
    it("renderiza títulos, énfasis, listas, enlaces, tablas y código", () => {
        render(<ChatMarkdown text={'## Hallazgos\n\n**Riesgo:** alto\n\n- Primero\n- Segundo\n\n| Paso | Responsable |\n| --- | --- |\n| Pago | Finanzas |\n\n`control` y [fuente](https://example.org)'} />);
        expect(screen.getByRole("heading", { name: "Hallazgos" })).toBeInTheDocument();
        expect(screen.getByText("Riesgo:")).toHaveProperty("tagName", "STRONG");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
        expect(screen.getByRole("table")).toBeInTheDocument();
        expect(screen.getByText("control")).toHaveProperty("tagName", "CODE");
        expect(screen.getByRole("link", { name: "fuente" })).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("no interpreta HTML ni carga imágenes remotas", () => {
        const { container } = render(<ChatMarkdown text={'<script>alert(1)</script>\n\n![secreto](https://example.org/track.png)'} />);
        expect(container.querySelector("script, img")).toBeNull();
        expect(screen.getByText("secreto")).toBeInTheDocument();
    });
});
