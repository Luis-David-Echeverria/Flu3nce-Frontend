import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatActivity } from "./chat-activity";

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("actividad de un trabajo largo", () => {
    it("muestra desde cuándo no llega señal sin declarar un fallo", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-09T12:00:00Z"));
        const updatedAt = Date.parse("2026-11-09T11:58:55Z");
        render(<ChatActivity items={[{ id: "a1", jobId: "j1", label: "Redactando el documento", kind: "job", state: "running", ms: 0, durationUnknown: true, updatedAt, expectHeartbeat: true }]} />);
        expect(screen.getAllByText("Redactando el documento").length).toBeGreaterThan(0);
        expect(screen.getByText(/Sin actualizaciones desde hace 1 min 5 s; sigue en curso/)).toBeInTheDocument();
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it("distingue la reconexión de la falta de señal", () => {
        render(<ChatActivity items={[{ id: "a1", label: "Leyendo el procedimiento", kind: "tool", state: "running", ms: 0, updatedAt: Date.now() }]} connection="reconnecting" />);
        expect(screen.getByText(/Reconectando…/)).toBeInTheDocument();
        expect(screen.queryByText(/Sin actualizaciones/)).not.toBeInTheDocument();
    });
});
