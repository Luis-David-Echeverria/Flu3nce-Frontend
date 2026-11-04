import { useEffect, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?worker&url";

/** Muestra una página a la vez: abrir una tarjeta no rasteriza toda la presentación. */
export function InlinePresentationPreview({ pdf, noun = "diapositiva" }: { pdf: Blob; noun?: "diapositiva" | "página" }) {
    const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
    const [page, setPage] = useState(1);
    const [image, setImage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        let active = true;
        let task: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
        setDocument(null);
        setPage(1);
        setImage(null);
        setLoading(true);
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
            } catch {
                if (active) { setError(true); setLoading(false); }
            }
        };
        void load();
        return () => {
            active = false;
            void task?.destroy();
        };
    }, [pdf]);

    useEffect(() => {
        if (!document) return;
        let active = true;
        let task: RenderTask | undefined;
        setImage(null);
        setLoading(true);
        setError(false);
        const render = async () => {
            try {
                const selected = await document.getPage(page);
                if (!active) return;
                const viewport = selected.getViewport({ scale: 1.25 });
                const canvas = window.document.createElement("canvas");
                const context = canvas.getContext("2d");
                if (!context) throw new Error("Canvas unavailable");
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                task = selected.render({ canvas, canvasContext: context, viewport, background: "var(--fl-bg)" });
                await task.promise;
                if (active) setImage(canvas.toDataURL("image/jpeg", 0.85));
            } catch {
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        };
        void render();
        return () => {
            active = false;
            task?.cancel();
        };
    }, [document, page]);

    if (error) return <p role="alert" className="text-xs text-[color:var(--fl-error-text)]">No pude preparar la vista aquí. Puedes descargar el PDF original.</p>;

    const nounLabel = noun.charAt(0).toLocaleUpperCase("es-MX") + noun.slice(1);

    return <div className="space-y-3">
        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-[#182c48] p-3 sm:p-5">
            {loading || !image ? <div role="status" className="flex items-center gap-2 text-xs font-medium text-white/80"><span className="flu-working-indicator flex gap-1" aria-hidden="true"><i /><i /><i /></span>Preparando {noun}…</div> : <img src={image} alt={`${nounLabel} ${page} de ${document?.numPages ?? 1}`} className={`${noun === "página" ? "w-full" : "max-h-[360px] w-auto"} max-w-full rounded-sm bg-[color:var(--fl-bg)] object-contain shadow-lg`} />}
        </div>
        {document && document.numPages > 1 ? <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} className="rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fl-link)] disabled:opacity-40">Anterior</button><span className="text-xs font-semibold text-[color:var(--fl-text-3)]">{nounLabel} {page} de {document.numPages}</span><button type="button" onClick={() => setPage((current) => Math.min(document.numPages, current + 1))} disabled={page === document.numPages} className="rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--fl-link)] disabled:opacity-40">Siguiente</button></div> : null}
    </div>;
}
