import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatJobActivity } from "./chat-job-activity";
import type { ChatMessage } from "./chat-timeline";

vi.mock("@/components/custom/consultation-deliverable-card", () => ({
    ConsultationDeliverableCard: () => <div>Vista del entregable</div>,
}));

afterEach(cleanup);

const status = (id: string, phase: "queued" | "running" | "done", stepLabel: string): ChatMessage => ({
    id, role: "system", kind: "generation_status", text: stepLabel, createdAt: "2026-10-17T10:00:00Z",
    generationStatus: { jobId: "job_1", target: "deliverable", deliverableTypes: ["policy_draft"], phase, stepLabel },
});

describe("tarjeta de actividad de un job", () => {
    const props = { jobId: "job_1", chatId: "chat_1", projectId: "project_1", canOperate: true, busy: false, onRetry: vi.fn() };

    it("muestra el error del job aunque el último mensaje del chat siga en curso", () => {
        render(<ChatJobActivity {...props} messages={[status("running", "running", "Preparando la política")]} verifiedJob={{ id: "job_1", status: "failed", error: { code: "output_invalid", message: "El modelo no devolvió una política válida." } }} />);
        expect(screen.getByRole("article")).toHaveTextContent("El modelo no devolvió una política válida.");
        expect(screen.getByRole("article")).not.toHaveTextContent("Ya puedes consultar");
        expect(screen.getByLabelText("Actividad de Flu3nce")).toHaveClass("is-complete");
        expect(screen.getByRole("article").querySelector(".flu-chat-activity-symbol")).toHaveTextContent("!");
    });

    it("distingue cancelación de una generación exitosa", () => {
        render(<ChatJobActivity {...props} messages={[status("running", "running", "Preparando la política")]} verifiedJob={{ id: "job_1", status: "cancelled" }} />);
        expect(screen.getByRole("article")).toHaveTextContent("El trabajo se detuvo");
        expect(screen.getByRole("article")).not.toHaveTextContent("Ya puedes consultar");
    });

    it("hace visible el fallo aunque todavía no haya mensajes de progreso", () => {
        render(<ChatJobActivity {...props} messages={[]} verifiedJob={{ id: "job_1", status: "failed", error: { code: "external_timeout", message: "El proveedor no respondió a tiempo." } }} />);
        expect(screen.getByRole("article").querySelector("summary")).toHaveTextContent("El proveedor no respondió a tiempo.");
        expect(screen.getByLabelText("Actividad de Flu3nce")).toHaveClass("is-complete");
    });

    it("no anuncia un entregable disponible si el servidor terminó sin resultado ni tarjeta", () => {
        render(<ChatJobActivity {...props} messages={[status("running", "running", "Preparando la política")]} verifiedJob={{ id: "job_1", status: "done" }} />);
        expect(screen.getByRole("article")).toHaveTextContent("El trabajo terminó sin devolver un resultado");
        expect(screen.getByRole("article")).not.toHaveTextContent("Ya puedes consultar");
    });

    it("conserva los resultados parciales sin anunciar que salió todo el paquete", () => {
        render(<ChatJobActivity {...props} messages={[status("running", "running", "Preparando política y presentación")]} verifiedJob={{ id: "job_1", status: "done", result: { resultKind: "package_partial", ok: false, deliverablesGenerated: 1, deliverablesExpected: 2, fieldsNotEmitted: [], partialReason: "La política está lista; la presentación no pudo generarse.", deepQuestionsPending: null, cancelRequestedTooLate: null, lateInputRounds: null, optionsIgnored: null } }} />);
        expect(screen.getByRole("article").querySelector("summary")).toHaveTextContent("Se completaron 1 de 2 entregables");
        expect(screen.getByRole("article")).toHaveTextContent("La política está lista; la presentación no pudo generarse.");
        expect(screen.getByRole("article").querySelector(".flu-chat-activity-symbol")).toHaveTextContent("!");
    });

    it("muestra vida sin reiniciar un contador ficticio cuando solo hay una consulta del job", () => {
        const { rerender } = render(<ChatJobActivity {...props} messages={[]} verifiedJob={{ id: "job_1", status: "running", lastHeartbeatAt: new Date().toISOString() }} />);
        expect(screen.getByRole("article").querySelector("summary")).toHaveTextContent("En curso");
        expect(screen.getByRole("article").querySelector("summary")).not.toHaveTextContent("0 s");
        rerender(<ChatJobActivity {...props} messages={[]} verifiedJob={{ id: "job_1", status: "running", lastHeartbeatAt: new Date().toISOString() }} />);
        expect(screen.getByRole("article").querySelector("summary")).not.toHaveTextContent("0 s");
    });

    it("cambia el estado en el mismo elemento y deja el entregable al terminar", () => {
        const props = { jobId: "job_1", chatId: "chat_1", projectId: "project_1", canOperate: true, busy: false, onRetry: vi.fn() };
        const queued = status("queued", "queued", "En cola: borrador de política");
        const running = status("running", "running", "Preparando el borrador de política");
        const { rerender } = render(<ChatJobActivity {...props} messages={[queued]} />);
        const article = screen.getByRole("article");
        expect(article).toHaveTextContent("En cola: borrador de política");

        rerender(<ChatJobActivity {...props} messages={[queued, running]} />);
        expect(screen.getByRole("article")).toBe(article);
        expect(article).toHaveTextContent("Preparando el borrador de política");

        const card: ChatMessage = {
            id: "card", role: "system", kind: "deliverable_card", text: "El borrador está disponible.",
            createdAt: "2026-10-17T10:00:02Z", unitId: "unit_1", refs: { jobId: "job_1" },
            deliverableCard: { deliverableId: "deliverable_1", deliverableType: "policy_draft", outcome: "generated", version: { id: "v1", number: 1 } },
        };
        rerender(<ChatJobActivity {...props} messages={[queued, running, card]} />);
        expect(screen.getByRole("article")).toBe(article);
        expect(article).toHaveTextContent("Ya puedes consultar política");
        expect(article).toHaveTextContent("Vista del entregable");
        expect(article).not.toHaveTextContent("card");
    });
});
