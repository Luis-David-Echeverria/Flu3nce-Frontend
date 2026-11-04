import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceApi = vi.hoisted(() => ({
    listSources: vi.fn(),
    uploadSource: vi.fn(),
}));

vi.mock("@/services/v2/sources", () => sourceApi);

import { ConsultationQuestions } from "./consultation-questions";
function QuestionForm({ job, projectId, onAnswer }: { job: import("@/services/v2/types").Job; projectId?: string; onAnswer: (answers: { questionId: string; value: unknown }[]) => Promise<void> }) {
    const questions = job.questions ?? [];
    return <ConsultationQuestions group={{ id: "questions", jobId: job.id, round: 1, title: `Para continuar sin hacer suposiciones, necesito confirmar ${questions.length === 1 ? "un dato" : `${questions.length} datos`} contigo.`, whatIsMissing: "Responde aquí mismo. Conservaré los resultados y versiones que ya estén listos.", whyItMatters: "", state: "open", questions }} projectId={projectId ?? ""} onAnswer={onAnswer} />;
}
import { makeJob, makeQuestion, makeSource } from "@/test/fixtures";
import type { Question } from "@/services/v2/types";

beforeEach(() => {
    sourceApi.listSources.mockReset().mockResolvedValue({ sources: [] });
    sourceApi.uploadSource.mockReset();
});

describe("QuestionForm: needs_input", () => {
    it("separa archivos, pasos y pregunta final cuando el backend los concatena", () => {
        const prompt = "**En 2 Proceso de compra.pdf, 4 Administración de RFX.pdf identificamos estos pasos, citados tal como aparecen: 1. «Genera una cesta de compra» (Solicitante) 2. «Aprueba la cesta» (Supervisor) No está claro que formen el proceso que quieres documentar. ¿Lo describen?**";
        render(<QuestionForm job={makeJob({ status: "needs_input", questions: [makeQuestion({ prompt })] })} onAnswer={vi.fn()} />);

        expect(screen.getByText("2 archivos citados")).toBeInTheDocument();
        expect(screen.getByText("Genera una cesta de compra", { exact: false }).closest("li")).toBeInTheDocument();
        expect(screen.getByText("Aprueba la cesta", { exact: false }).closest("li")).toBeInTheDocument();
        expect(screen.getByText(/No está claro que formen el proceso/)).toBeInTheDocument();
    });

    it("presenta needs_input como una consulta contextual de Flu", () => {
        render(
            <QuestionForm
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ prompt: "¿Cuál es el objetivo?" })] })}
                onAnswer={vi.fn()}
            />,
        );

        expect(screen.getByRole("region", { name: "Consulta de Flu3nce" })).toBeInTheDocument();
        expect(screen.getByText("Flu3nce")).toBeInTheDocument();
        expect(screen.getByText(/Para continuar sin hacer suposiciones/)).toBeInTheDocument();
        expect(screen.queryByText("Antes de continuar, respóndeme esto")).not.toBeInTheDocument();
    });

    it("mantiene deshabilitado Continuar hasta contestar una pregunta requerida", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        render(
            <QuestionForm
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ prompt: "¿Cuál es el objetivo?" })] })}
                onAnswer={onAnswer}
            />,
        );

        const continueButton = screen.getByRole("button", { name: "Continuar" });
        expect(continueButton).toBeDisabled();
        await user.type(screen.getByRole("textbox"), "Reducir el tiempo de aprobación");
        expect(continueButton).toBeEnabled();
        await user.click(continueButton);

        expect(onAnswer).toHaveBeenCalledWith([
            { questionId: "question_1", value: "Reducir el tiempo de aprobación" },
        ]);
    });

    it("permite omitir preguntas opcionales", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        render(
            <QuestionForm
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ required: false })] })}
                onAnswer={onAnswer}
            />,
        );

        expect(screen.getByText("Opcional")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "question_1", value: undefined }]);
    });

    it("envía selección simple, múltiple, booleano y número con sus tipos", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        const questions: Question[] = [
            makeQuestion({ id: "process", prompt: "¿Qué proceso?", kind: "single_choice", options: ["Cobranza", "Compras"] }),
            makeQuestion({ id: "areas", prompt: "¿Qué áreas?", kind: "multi_choice", options: ["Finanzas", "Legal"] }),
            makeQuestion({ id: "approved", prompt: "¿Está aprobado?", kind: "boolean" }),
            makeQuestion({ id: "slides", prompt: "¿Cuántas diapositivas?", kind: "number" }),
        ];
        render(<QuestionForm job={makeJob({ status: "needs_input", questions })} onAnswer={onAnswer} />);

        await user.click(screen.getByRole("button", { name: "Cobranza" }));
        await user.click(screen.getByRole("button", { name: "Finanzas" }));
        await user.click(screen.getByRole("button", { name: "Legal" }));
        await user.click(screen.getByRole("button", { name: "Sí" }));
        await user.type(screen.getByRole("spinbutton"), "12");
        await user.click(screen.getByRole("button", { name: "Continuar" }));

        expect(onAnswer).toHaveBeenCalledWith([
            { questionId: "process", value: "Cobranza" },
            { questionId: "areas", value: ["Finanzas", "Legal"] },
            { questionId: "approved", value: true },
            { questionId: "slides", value: 12 },
        ]);
    });

    it("renderiza números acotados como slider y conserva el valor numérico", async () => {
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        const ranged = makeQuestion({ id: "steps", prompt: "Máximo de pasos", kind: "number" }) as Question & {
            min: number;
            max: number;
            step: number;
            unit: string;
        };
        Object.assign(ranged, { min: 5, max: 50, step: 5, unit: "pasos" });
        render(<QuestionForm job={makeJob({ status: "needs_input", questions: [ranged] })} onAnswer={onAnswer} />);

        fireEvent.change(screen.getByRole("slider"), { target: { value: "35" } });
        await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "steps", value: 35 }]);
    });

    it("ofrece Otro en selección simple cuando el contrato lo permite", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        const question = makeQuestion({ kind: "single_choice", options: ["Cobranza", "Compras"] }) as Question & {
            allowOther: boolean;
            otherLabel: string;
        };
        Object.assign(question, { allowOther: true, otherLabel: "Otro proceso" });
        render(<QuestionForm job={makeJob({ status: "needs_input", questions: [question] })} onAnswer={onAnswer} />);

        await user.click(screen.getByRole("button", { name: "Otro proceso" }));
        await user.type(screen.getByPlaceholderText("Escribe otra respuesta"), "Tesorería");
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "question_1", value: "Tesorería" }]);
    });

    it("prepara excepciones de Question.overrides bajo la pregunta de grupo", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        const principal = makeQuestion({ id: "owner-group", prompt: "¿Quién aprueba estas acciones?" });
        Object.assign(principal, { steps: ["1"] });
        const exception = makeQuestion({ id: "owner-exception", prompt: "¿Quién cancela la solicitud?", required: false }) as Question & { overrides: string };
        Object.assign(exception, { overrides: "owner-group" });

        render(<QuestionForm job={makeJob({ status: "needs_input", questions: [principal, exception] })} onAnswer={onAnswer} />);

        expect(screen.getByText("Aplica a estos pasos")).toBeInTheDocument();
        expect(screen.getByText("Paso 1")).toBeInTheDocument();
        await user.click(screen.getByText("Este paso tiene un responsable distinto"));
        expect(screen.getByText("¿Quién cancela la solicitud?")).toBeInTheDocument();
    });

    it("reutiliza automáticamente la única fuente compatible del proyecto", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        sourceApi.listSources.mockResolvedValue({
            sources: [
                makeSource({ id: "pdf_1", name: "Politica.pdf" }),
                makeSource({ id: "video_1", name: "Reunion.mp4", mime: "video/mp4", kind: "video" }),
            ],
        });
        render(
            <QuestionForm
                projectId="project_1"
                job={makeJob({
                    status: "needs_input",
                    questions: [makeQuestion({ kind: "file", allowedExtensions: ["pdf"], prompt: "¿Qué política revisamos?" })],
                })}
                onAnswer={onAnswer}
            />,
        );

        await screen.findByText("Politica.pdf");
        expect(screen.queryByText("Reunion.mp4")).not.toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled());
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "question_1", value: "pdf_1" }]);
        expect(sourceApi.uploadSource).not.toHaveBeenCalled();
    });

    it("permite escoger varias fuentes existentes sin volver a subirlas", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        sourceApi.listSources.mockResolvedValue({
            sources: [makeSource({ id: "pdf_1", name: "Proceso.pdf" }), makeSource({ id: "pdf_2", name: "Reglas.pdf" })],
        });
        render(
            <QuestionForm
                projectId="project_1"
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ kind: "files", allowedExtensions: [".pdf"] })] })}
                onAnswer={onAnswer}
            />,
        );

        await user.click(await screen.findByRole("button", { name: /Proceso\.pdf/ }));
        await user.click(screen.getByRole("button", { name: /Reglas\.pdf/ }));
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "question_1", value: ["pdf_1", "pdf_2"] }]);
    });

    it("sube un archivo nuevo y responde con el sourceId", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockResolvedValue(undefined);
        sourceApi.uploadSource.mockResolvedValue(makeSource({ id: "uploaded_1", name: "Proceso.docx" }));
        const { container } = render(
            <QuestionForm
                projectId="project_1"
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ kind: "file", allowedExtensions: ["docx"] })] })}
                onAnswer={onAnswer}
            />,
        );

        const input = container.querySelector<HTMLInputElement>('input[type="file"]');
        expect(input).not.toBeNull();
        const file = new File(["contenido"], "Proceso.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
        await user.upload(input as HTMLInputElement, file);
        await user.click(screen.getByRole("button", { name: "Continuar" }));

        expect(sourceApi.uploadSource).toHaveBeenCalledWith("project_1", file);
        expect(onAnswer).toHaveBeenCalledWith([{ questionId: "question_1", value: "uploaded_1" }]);
    });

    it("conserva los sourceId si el envío de respuestas falla", async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn().mockRejectedValue(new Error("network"));
        sourceApi.listSources.mockResolvedValue({ sources: [makeSource({ id: "pdf_1", name: "Proceso.pdf" })] });
        render(
            <QuestionForm
                projectId="project_1"
                job={makeJob({ status: "needs_input", questions: [makeQuestion({ kind: "file", allowedExtensions: ["pdf"] })] })}
                onAnswer={onAnswer}
            />,
        );

        await screen.findByText("Proceso.pdf");
        await waitFor(() => expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled());
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(await screen.findByText("No pudimos guardar tus respuestas. Intenta nuevamente.")).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Continuar" }));
        expect(onAnswer).toHaveBeenNthCalledWith(2, [{ questionId: "question_1", value: "pdf_1" }]);
    });
});
