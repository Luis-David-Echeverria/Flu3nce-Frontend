import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConsultationMessage } from "@/services/v2/types";
import { ApiServiceError } from "@/services/v2/http";

const api = vi.hoisted(() => ({ getDeliverable: vi.fn(), getDeliverableJson: vi.fn(), getDeliverablePreview: vi.fn(), downloadDeliverable: vi.fn(), downloadDeliverableVersion: vi.fn(), getDeliverableVersionJson: vi.fn(), listDeliverableVersions: vi.fn() }));
vi.mock("@/services/v2/deliverables", () => api);
vi.mock("./consultation-presentation-preview", () => ({ InlinePresentationPreview: () => <p>Diapositiva preparada</p> }));
vi.mock("@/pages/flu-pdf-document", () => ({ FluPdfDocument: ({ edgeToEdge }: { edgeToEdge?: boolean }) => <div aria-label="PDF completo" data-edge-to-edge={edgeToEdge} /> }));
vi.mock("@/pages/flu-source-preview", () => ({ FluDocxViewer: () => <div aria-label="Word completo" /> }));
vi.mock("./flu-diagram-preview", () => ({ FluDiagramPreview: () => <div role="img" aria-label="Diagrama completo" /> }));

import { ConsultationDeliverableCard } from "./consultation-deliverable-card";

const diagnostic: NonNullable<ConsultationMessage["deliverableCard"]> = {
    deliverableId: "deliverable_1", deliverableType: "diagnostic", outcome: "generated",
    version: { id: "version_1", number: 1 }, summary: "Se encontró un control sin seguimiento.",
};

beforeEach(() => {
    api.getDeliverablePreview.mockReset().mockRejectedValue(new Error("Vista estructurada aún no desplegada"));
    api.getDeliverable.mockReset().mockResolvedValue({ currentVersion: 1 });
    api.getDeliverableJson.mockReset().mockResolvedValue({
        schemaVersion: "diagnostic-v1", resumenEjecutivo: "Falta seguimiento de indicadores.",
        dimensions: [{ id: "medicion", name: "Medición", soWhat: "No hay métricas vigentes." }],
    });
    api.downloadDeliverable.mockReset().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" }));
    api.downloadDeliverableVersion.mockReset().mockResolvedValue(new Blob(["old pdf"], { type: "application/pdf" }));
    api.getDeliverableVersionJson.mockReset().mockRejectedValue(new ApiServiceError("Sin contenido propio", "version_not_restorable"));
    api.listDeliverableVersions.mockReset().mockResolvedValue({ current: "version_1", versions: [{ id: "version_1", number: 1, createdAt: "2026-10-17T10:00:00Z" }] });
});

describe("vista rápida de entregables en la conversación", () => {
    it("abre el documento general como Markdown legible sin ejecutar HTML ni cargar imágenes remotas", async () => {
        api.getDeliverablePreview.mockResolvedValue({ title: "Hallazgos", version: { id: "version_1", number: 1 }, isCurrentVersion: true, formats: ["md"], contentAvailable: true, content: { schemaVersion: "document-v1", markdown: "# Hallazgos del proceso\n\n| Indicador | Valor |\n| --- | --- |\n| Tiempo | 5 días |\n\n<script>alert('x')</script>\n\n![Imagen externa](https://example.invalid/imagen.png)" } });
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "document" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        expect(await screen.findByRole("heading", { name: "Hallazgos del proceso" })).toBeInTheDocument();
        expect(screen.getByRole("table")).toHaveTextContent("Tiempo");
        expect(document.querySelector("script, img[src] ")).toBeNull();
        expect(screen.getByRole("button", { name: "Descargar original" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
    });

    it("explica que el PDF se está preparando sin sustituir la versión solicitada", async () => {
        api.getDeliverablePreview.mockResolvedValue({ title: "Hallazgos", version: { id: "version_1", number: 1 }, isCurrentVersion: true, formats: ["md"], contentAvailable: true, content: { schemaVersion: "document-v1", markdown: "# Hallazgos" } });
        api.downloadDeliverableVersion.mockRejectedValue(new ApiServiceError("Preparando", "representation_not_available", { state: "preparing", retryAfter: 5 }));
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "document" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        await screen.findByRole("heading", { name: "Hallazgos" });
        fireEvent.click(screen.getByRole("button", { name: "Descargar PDF" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("El PDF de esta versión se está preparando");
        expect(api.downloadDeliverableVersion).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1", "pdf");
        expect(api.downloadDeliverable).not.toHaveBeenCalled();
    });
    it("abre el Word de una versión concreta cuando todavía no existe su PDF", async () => {
        api.getDeliverablePreview.mockResolvedValue({ title: "Política", version: { id: "version_1", number: 1 }, isCurrentVersion: false, contentAvailable: false, formats: ["docx"] });
        api.downloadDeliverableVersion.mockResolvedValue(new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "policy_draft" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        expect(await screen.findByLabelText("Word completo")).toBeInTheDocument();
        expect(api.downloadDeliverableVersion).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1", "docx");
        expect(screen.queryByRole("button", { name: "PDF" })).not.toBeInTheDocument();
        expect(api.downloadDeliverable).not.toHaveBeenCalled();
    });

    it("abre el diagrama completo en el panel en vez de la vista parcial", async () => {
        api.getDeliverableJson.mockResolvedValue({ schemaVersion: "contrato-a" });
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "diagram_as_is" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        expect(await screen.findByRole("img", { name: "Diagrama completo" })).toBeInTheDocument();
        expect(screen.queryByText(/Vista parcial de la secuencia/)).not.toBeInTheDocument();
    });

    it("mantiene abierto el contenido del panel sin un control para ocultarlo", async () => {
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);

        expect(await screen.findByText("Falta seguimiento de indicadores.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Ocultar vista" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Vista rápida" })).not.toBeInTheDocument();
    });

    it("lee la política completa como documento en vez de repetir la tarjeta", async () => {
        api.getDeliverablePreview.mockResolvedValue({
            title: "Política de compras", version: { id: "version_1", number: 1 },
            isCurrentVersion: true, formats: ["json"], contentAvailable: true,
            content: { schemaVersion: "policy-draft-v1", policyName: "Política de compras", policyCode: "COM-001", policyType: "Compras", objetivo: "Definir aprobaciones.", alcance: "Todas las áreas.", definiciones: [], lineamientosGenerales: ["Registrar cada solicitud."], lineamientosEspecificos: ["Dirección autoriza."], coordinacionInterdepartamental: "Finanzas revisa.", responsables: { dirección: "Aprobar" }, otrasDisposiciones: "", sanciones: "", vigencia: "Anual" },
        });
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "policy_draft" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        expect(await screen.findByRole("article", { name: "Documento: Política de compras" })).toBeInTheDocument();
        expect(screen.getByText("Dirección autoriza.")).toBeInTheDocument();
        expect(screen.queryByText("Nueva versión")).not.toBeInTheDocument();
    });

    it("carga contenido solo al expandir, sin enviar a una pantalla de detalle", async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" /></MemoryRouter>);

        expect(screen.getByText("Se encontró un control sin seguimiento.")).toBeInTheDocument();
        expect(api.getDeliverable).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Vista rápida" }));

        expect(await screen.findByText("Falta seguimiento de indicadores.")).toBeInTheDocument();
        expect(screen.getByText("Resumen ejecutivo")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /Abrir detalle e historial/ })).not.toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Ocultar vista" }));
        expect(screen.queryByText("Falta seguimiento de indicadores.")).not.toBeInTheDocument();
    });

    it("no confunde una versión histórica con el contenido vigente", async () => {
        const user = userEvent.setup();
        api.getDeliverable.mockResolvedValue({ currentVersion: 2 });
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" /></MemoryRouter>);

        await user.click(screen.getByRole("button", { name: "Vista rápida" }));
        expect(await screen.findByText(/La vigente es la 2/)).toBeInTheDocument();
        expect(api.getDeliverableJson).not.toHaveBeenCalled();
        expect(api.getDeliverableVersionJson).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1");
    });

    it("muestra la versión histórica exacta cuando llega la vista estructurada", async () => {
        const user = userEvent.setup();
        api.getDeliverablePreview.mockResolvedValue({
            title: "Diagnóstico de asistencia", version: { id: "version_1", number: 1 },
            isCurrentVersion: false, contentAvailable: true,
            content: { schemaVersion: "diagnostic-v1", resumenEjecutivo: "Versión original.", dimensions: [] },
        });
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" /></MemoryRouter>);
        await user.click(screen.getByRole("button", { name: "Vista rápida" }));
        expect(await screen.findByText("Versión original.")).toBeInTheDocument();
        expect(api.getDeliverablePreview).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1");
        expect(api.getDeliverableJson).not.toHaveBeenCalled();
    });

    it("lee el contenido propio de una versión anterior si la vista estructurada no está disponible", async () => {
        const user = userEvent.setup();
        api.getDeliverable.mockResolvedValue({ currentVersion: 2 });
        api.getDeliverableVersionJson.mockResolvedValue({ schemaVersion: "diagnostic-v1", resumenEjecutivo: "Contenido original.", dimensions: [] });
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" /></MemoryRouter>);
        await user.click(screen.getByRole("button", { name: "Vista rápida" }));
        expect(await screen.findByText("Contenido original.")).toBeInTheDocument();
        expect(api.getDeliverableJson).not.toHaveBeenCalled();
    });

    it("permite elegir una versión anterior en el panel sin mostrar la vigente en su lugar", async () => {
        const user = userEvent.setup();
        api.listDeliverableVersions.mockResolvedValue({ current: "version_2", versions: [
            { id: "version_2", number: 2, createdAt: "2026-10-17T11:00:00Z" },
            { id: "version_1", number: 1, createdAt: "2026-10-17T10:00:00Z" },
        ] });
        api.getDeliverablePreview.mockImplementation(async (_projectId: string, _deliverableId: string, versionId: string) => ({
            title: "Diagnóstico", version: { id: versionId, number: versionId === "version_1" ? 1 : 2 },
            isCurrentVersion: versionId === "version_2", formats: ["json"], contentAvailable: true,
            content: { schemaVersion: "diagnostic-v1", resumenEjecutivo: versionId === "version_1" ? "Texto anterior." : "Texto vigente.", dimensions: [] },
        }));
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, version: { id: "version_2", number: 2 } }} projectId="project_1" unitId="unit_1" initiallyExpanded fullPreview /></MemoryRouter>);
        expect(await screen.findByText("Texto vigente.")).toBeInTheDocument();
        await user.selectOptions(screen.getByRole("combobox", { name: "Versión del entregable" }), "version_1");
        expect(await screen.findByText("Texto anterior.")).toBeInTheDocument();
        expect(screen.queryByText("Texto vigente.")).not.toBeInTheDocument();
    });

    it("prepara una presentación como diapositivas, sin descargarla al pintar la tarjeta", async () => {
        const user = userEvent.setup();
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "presentation" }} projectId="project_1" unitId="unit_1" /></MemoryRouter>);

        expect(api.downloadDeliverable).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Vista rápida" }));
        await waitFor(() => expect(api.downloadDeliverable).toHaveBeenCalledWith("project_1", "deliverable_1", "pdf"));
        expect(await screen.findByText("Diapositiva preparada")).toBeInTheDocument();
    });

    it("ofrece el PPTX editable y el PDF por separado cuando existen en la versión", async () => {
        const user = userEvent.setup();
        api.getDeliverablePreview.mockResolvedValue({
            title: "Presentación de compras", version: { id: "version_1", number: 1 },
            isCurrentVersion: true, formats: ["pdf", "pptx"], contentAvailable: false,
        });
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "presentation" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        await screen.findByLabelText("PDF completo");
        expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Descargar original" }));
        await waitFor(() => expect(api.downloadDeliverableVersion).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1", undefined));
    });

    it("abre la representación visual de la versión exacta en el panel", async () => {
        api.getDeliverablePreview.mockResolvedValue({
            title: "Presentación de compras", version: { id: "version_1", number: 1 },
            isCurrentVersion: false, formats: ["pdf", "pptx"], contentAvailable: true,
            content: { schemaVersion: "presentation-preview-v1", slides: [{ number: 1, title: "Resumen", blocks: [] }] },
        });
        render(<MemoryRouter><ConsultationDeliverableCard card={{ ...diagnostic, deliverableType: "presentation" }} projectId="project_1" unitId="unit_1" fullPreview /></MemoryRouter>);
        expect(await screen.findByLabelText("PDF completo")).toHaveAttribute("data-edge-to-edge", "true");
        expect(api.downloadDeliverableVersion).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1", "pdf");
        expect(screen.queryByText(/Diapositiva 1 · Resumen/)).not.toBeInTheDocument();
    });

    it("abre el panel bajo demanda y carga allí la versión seleccionada", async () => {
        const user = userEvent.setup();
        const openPanel = vi.fn();
        const card = { ...diagnostic, deliverableType: "presentation" as const };
        const view = render(<MemoryRouter><ConsultationDeliverableCard card={card} projectId="project_1" unitId="unit_1" onOpenPanel={openPanel} /></MemoryRouter>);
        expect(api.getDeliverablePreview).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Ver entregable" }));
        expect(openPanel).toHaveBeenCalledOnce();
        view.unmount();
        render(<MemoryRouter><ConsultationDeliverableCard card={card} projectId="project_1" unitId="unit_1" initiallyExpanded fullPreview /></MemoryRouter>);
        await waitFor(() => expect(api.getDeliverablePreview).toHaveBeenCalledWith("project_1", "deliverable_1", "version_1"));
        expect(await screen.findByLabelText("PDF completo")).toBeInTheDocument();
    });

    it("permite leer un diagnóstico en el chat sin abrir el panel", async () => {
        const user = userEvent.setup();
        const openPanel = vi.fn();
        render(<MemoryRouter><ConsultationDeliverableCard card={diagnostic} projectId="project_1" unitId="unit_1" onOpenPanel={openPanel} /></MemoryRouter>);
        expect(api.getDeliverablePreview).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Leer aquí" }));
        expect(await screen.findByText("Falta seguimiento de indicadores.")).toBeInTheDocument();
        expect(openPanel).not.toHaveBeenCalled();
    });
});
