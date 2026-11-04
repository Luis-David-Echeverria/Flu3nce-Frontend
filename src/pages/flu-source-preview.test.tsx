import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FluSourcePreview, SourceTypeIcon } from "./flu-source-preview";
import type { Source } from "@/services/v2/types";

const downloadSource = vi.hoisted(() => vi.fn());
const renderDocx = vi.hoisted(() => vi.fn());
vi.mock("@/services/v2/sources", () => ({ downloadSource }));
vi.mock("docx-preview", () => ({ renderAsync: renderDocx }));
vi.mock("./flu-pdf-document", () => ({ FluPdfDocument: () => <div aria-label="Visor de PDF">Páginas del PDF</div> }));

function source(name: string, mime: string, status: Source["status"] = "ready"): Source {
    return { id: "source_1", projectId: "project_1", name, mime, status, currentVersion: 1, createdAt: "2026-10-19T00:00:00Z" };
}

beforeEach(() => {
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:original"), revokeObjectURL: vi.fn() });
    downloadSource.mockResolvedValue(new Blob(["Contenido de prueba"], { type: "text/plain" }));
    renderDocx.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe("vista del archivo original", () => {
    it("muestra PDF en el panel y conserva una descarga del original", async () => {
        render(<FluSourcePreview source={source("reporte.pdf", "application/pdf")} projectId="project_1" />);
        expect(await screen.findByLabelText("Visor de PDF")).toBeInTheDocument();
        expect(screen.queryByTitle("PDF: reporte.pdf")).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Abrir aparte" })).toHaveAttribute("target", "_blank");
        expect(screen.getByRole("link", { name: "Descargar original" })).toHaveAttribute("download", "reporte.pdf");
    });

    it("abre documentos Word en una vista de lectura", async () => {
        render(<FluSourcePreview source={source("politica.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")} projectId="project_1" />);
        expect(await screen.findByLabelText("Documento Word")).toBeInTheDocument();
        expect(renderDocx).toHaveBeenCalledWith(expect.any(Blob), expect.any(HTMLElement), expect.any(HTMLElement), expect.objectContaining({ breakPages: true }));
        expect(screen.getByRole("link", { name: "Descargar original" })).toHaveAttribute("download", "politica.docx");
    });

    it("muestra el texto sin pedirle al usuario que lo resuma", async () => {
        render(<FluSourcePreview source={source("notas.txt", "text/plain")} projectId="project_1" />);
        expect(await screen.findByText("Contenido de prueba")).toBeInTheDocument();
        expect(downloadSource).toHaveBeenCalledWith("project_1", "source_1");
    });

    it("distingue audio del estado de lectura para Flu3nce", () => {
        render(<SourceTypeIcon source={source("reunión.mp3", "audio/mpeg", "failed")} />);
        expect(screen.getByText("AUDIO")).toBeInTheDocument();
    });
});
