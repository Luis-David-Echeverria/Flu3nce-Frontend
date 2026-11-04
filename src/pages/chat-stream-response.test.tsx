import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatStreamResponse } from "./chat-stream-response";
import { beginLiveTurn, type LiveTurn } from "./chat-stream-state";
afterEach(cleanup);

describe("contenido visible durante el stream", () => {
    it("mantiene bloques Markdown independientes y tarjetas intercaladas de la versión exacta", () => {
        const open = vi.fn();
        const card = { deliverableId: "d1", deliverableType: "policy_draft" as const, outcome: "generated" as const, version: { id: "v1", number: 1 } };
        const turn: LiveTurn = { ...beginLiveTurn("c1", "request", "Revisa"), phaseB: true, legacyText: "Duplicado anterior", parts: [
            { id: "p1", index: 0, kind: "text", blocks: [{ seq: 1, text: "## Hallazgos" }, { seq: 2, text: "La aprobación requiere seguimiento." }] },
            { id: "p2", index: 1, kind: "deliverable_card", blocks: [], card },
            { id: "p3", index: 2, kind: "text", blocks: [{ seq: 3, text: "Con esta política preparo la presentación." }] },
        ] };
        const { container } = render(<ChatStreamResponse turn={turn} onOpenDeliverable={open} />);
        expect(screen.getByRole("heading", { name: "Hallazgos" })).toBeInTheDocument();
        expect(screen.getByText("La aprobación requiere seguimiento.")).toBeInTheDocument();
        expect(screen.queryByText("Duplicado anterior")).not.toBeInTheDocument();
        const ordered = container.querySelectorAll("article, button");
        expect([...ordered].map((element) => element.textContent)).toEqual(["HallazgosLa aprobación requiere seguimiento.", "▤PolíticaVersión 1→", "Con esta política preparo la presentación."]);
        fireEvent.click(screen.getByRole("button", { name: /PolíticaVersión 1/ }));
        expect(open).toHaveBeenCalledWith(card);
    });

    it("muestra varios entregables como tarjetas y distingue el que sigue preparándose", () => {
        const pending = { deliverableId: "d1", deliverableType: "policy_draft" as const, outcome: "generated" as const, status: "generating" as const };
        const ready = { deliverableId: "d2", deliverableType: "presentation" as const, outcome: "generated" as const, status: "ready" as const, version: { id: "v2", number: 2 } };
        const turn: LiveTurn = { ...beginLiveTurn("c1", "request", "Ambos"), parts: [
            { id: "p1", index: 0, kind: "deliverable_card", blocks: [], card: pending },
            { id: "p2", index: 1, kind: "deliverable_card", blocks: [], card: ready },
        ] };
        const { container } = render(<ChatStreamResponse turn={turn} onOpenDeliverable={vi.fn()} />);
        expect(container.querySelectorAll(".flu-chat-stream-card")).toHaveLength(2);
        expect(screen.getByRole("button", { name: /PolíticaPreparando entregable/ })).toBeDisabled();
        expect(screen.getByRole("button", { name: /Presentación ejecutivaVersión 2/ })).toBeEnabled();
    });
});
