import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";

function PdfPage({ document, number, width, scrollRoot }: { document: PDFDocumentProxy; number: number; width: number; scrollRoot: React.RefObject<HTMLDivElement | null> }) {
    const pageRef = useRef<HTMLElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [visible, setVisible] = useState(number === 1);
    const [ratio, setRatio] = useState(0.707);
    const [rendered, setRendered] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        const target = pageRef.current;
        if (!target) return;
        if (!window.IntersectionObserver) { setVisible(true); return; }
        const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { root: scrollRoot.current, rootMargin: "700px 0px" });
        observer.observe(target);
        return () => observer.disconnect();
    }, [scrollRoot]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !visible) return;
        let active = true;
        let task: RenderTask | undefined;
        setRendered(false);
        setError(false);
        const render = async () => {
            try {
                const page = await document.getPage(number);
                if (!active) return;
                const natural = page.getViewport({ scale: 1 });
                setRatio(natural.width / natural.height);
                const density = Math.min(window.devicePixelRatio || 1, 2);
                const viewport = page.getViewport({ scale: width * density / natural.width });
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Canvas unavailable");
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                task = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
                await task.promise;
                if (active) setRendered(true);
            } catch (caught) {
                if (active && !(caught instanceof Error && caught.name === "RenderingCancelledException")) setError(true);
            }
        };
        void render();
        return () => { active = false; task?.cancel(); canvas.width = 0; canvas.height = 0; };
    }, [document, number, visible, width]);

    return <section ref={pageRef} className="flu-pdf-page" style={{ width: `${width}px`, aspectRatio: `${ratio}` }} aria-label={`Página ${number} de ${document.numPages}`}>
        <canvas ref={canvasRef} aria-hidden="true" className={rendered ? "is-ready" : ""} />
        {!rendered ? <span role={error ? "alert" : "status"} className="flu-pdf-page-placeholder">{error ? "No se pudo mostrar esta página." : `Preparando página ${number}…`}</span> : null}
        <span className="flu-pdf-page-number" aria-hidden="true">{number}</span>
    </section>;
}

/** Visor de lectura continuo: solo rasteriza las páginas próximas a la vista. */
export function FluPdfDocument({ pdf, edgeToEdge = false }: { pdf: Blob; edgeToEdge?: boolean }) {
    const scrollRoot = useRef<HTMLDivElement>(null);
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [width, setWidth] = useState(700);
    const [zoom, setZoom] = useState(1);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
        setDocument(null);
        setError(false);
        const load = async () => {
            try {
                const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
                GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
                const data = new Uint8Array(await pdf.arrayBuffer());
                if (!active) return;
                task = getDocument({ data });
                const loaded = await task.promise;
                if (active) setDocument(loaded);
            } catch { if (active) setError(true); }
        };
        void load();
        return () => { active = false; void task?.destroy(); };
    }, [pdf]);

    useEffect(() => {
        const target = scrollRoot.current;
        if (!target) return;
        const measure = () => { if (target.clientWidth) setWidth(Math.max(160, Math.floor(target.clientWidth - (edgeToEdge ? 0 : 32)))); };
        measure();
        if (!window.ResizeObserver) { window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure); }
        const observer = new ResizeObserver(measure);
        observer.observe(target);
        return () => observer.disconnect();
    }, [edgeToEdge]);

    return <div className={`flu-pdf-document ${edgeToEdge ? "is-edge-to-edge" : ""}`} aria-label="Visor de PDF">
        <div className="flu-pdf-toolbar"><span>{document ? `${document.numPages} ${document.numPages === 1 ? "página" : "páginas"}` : "Documento PDF"}</span><div aria-label="Zoom del PDF"><button type="button" aria-label="Reducir PDF" disabled={zoom <= 0.75} onClick={() => setZoom((value) => Math.max(0.75, Math.round((value - 0.25) * 100) / 100))}>−</button><span>{Math.round(zoom * 100)} %</span><button type="button" aria-label="Ampliar PDF" disabled={zoom >= 2} onClick={() => setZoom((value) => Math.min(2, Math.round((value + 0.25) * 100) / 100))}>＋</button><button type="button" onClick={() => setZoom(1)}>Ajustar ancho</button></div></div>
        <div ref={scrollRoot} className="flu-pdf-pages">
            {error ? <p role="alert">No se pudo mostrar el PDF. Puedes descargar el original.</p> : !document ? <p role="status">Abriendo PDF…</p> : Array.from({ length: document.numPages }, (_, index) => <PdfPage key={index + 1} document={document} number={index + 1} width={Math.round(width * zoom)} scrollRoot={scrollRoot} />)}
        </div>
    </div>;
}
