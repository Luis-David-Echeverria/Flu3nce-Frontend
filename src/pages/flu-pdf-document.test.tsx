import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FluPdfDocument } from "./flu-pdf-document";

const pdfMocks = vi.hoisted(() => ({ getDocument: vi.fn(), getPage: vi.fn(), renderPage: vi.fn() }));
vi.mock("pdfjs-dist", () => ({ getDocument: pdfMocks.getDocument, GlobalWorkerOptions: { workerSrc: "" } }));

beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as CanvasRenderingContext2D);
    pdfMocks.renderPage.mockImplementation(() => ({ promise: Promise.resolve(), cancel: vi.fn() }));
    pdfMocks.getPage.mockImplementation(async () => ({
        getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
        render: pdfMocks.renderPage,
    }));
    pdfMocks.getDocument.mockImplementation(() => ({ promise: Promise.resolve({ numPages: 3, getPage: pdfMocks.getPage }), destroy: vi.fn() }));
});

describe("visor de PDF del archivo original", () => {
    it("muestra las páginas dentro del panel y permite ampliar el documento", async () => {
        render(<FluPdfDocument pdf={new Blob(["pdf"], { type: "application/pdf" })} />);
        expect(await screen.findByText("3 páginas")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Página 1 de 3" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Página 3 de 3" })).toBeInTheDocument();
        await waitFor(() => expect(pdfMocks.renderPage).toHaveBeenCalled());
        fireEvent.click(screen.getByRole("button", { name: "Ampliar PDF" }));
        expect(screen.getByText("125 %")).toBeInTheDocument();
    });
});
