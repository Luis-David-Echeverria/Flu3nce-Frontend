import { useEffect, useRef, useState } from "react";
import { downloadSource } from "@/services/v2/sources";
import type { Source } from "@/services/v2/types";
import { FluPdfDocument } from "./flu-pdf-document";

export function sourceFormat(source: Source): "pdf" | "docx" | "text" | "audio" | "video" | "other" {
    const mime = source.mime?.toLowerCase() ?? "";
    const name = source.name.toLowerCase();
    if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
    if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || name.endsWith(".docx")) return "docx";
    if (mime.startsWith("text/") || /\.(txt|md|csv|json)$/.test(name)) return "text";
    if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg)$/.test(name)) return "audio";
    if (mime.startsWith("video/") || /\.(mp4|webm|mov)$/.test(name)) return "video";
    return "other";
}

export function SourceTypeIcon({ source }: { source: Source }) {
    const format = sourceFormat(source);
    const label = format === "other" ? source.name.split(".").pop()?.slice(0, 4) ?? "FILE" : format === "text" ? "TXT" : format.toUpperCase();
    return <span aria-hidden="true" className={`flu-source-type flu-source-type-${format}`}>{label}</span>;
}

export function FluDocxViewer({ blob }: { blob: Blob }) {
    const container = useRef<HTMLDivElement>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const target = container.current;
        if (!target) return;
        target.replaceChildren();
        setError(false);
        setLoading(true);
        void import("docx-preview").then(({ renderAsync }) => renderAsync(blob, target, target, {
            breakPages: true,
            ignoreWidth: true,
            ignoreHeight: true,
            renderAltChunks: false,
            useBase64URL: true,
        })).then(() => { if (active) setLoading(false); }).catch(() => { if (active) { setError(true); setLoading(false); } });
        return () => { active = false; target.replaceChildren(); };
    }, [blob]);

    return <div className="flu-source-preview-docx" aria-label="Documento Word">
        {loading ? <p role="status" className="flu-source-preview-status">Abriendo documento Word…</p> : null}
        {error ? <p role="alert" className="flu-source-preview-status">No se pudo mostrar este documento. Puedes descargar el original.</p> : null}
        <div ref={container} />
    </div>;
}

export function FluSourcePreview({ source, projectId }: { source: Source; projectId: string }) {
    const [state, setState] = useState<{ url?: string; blob?: Blob; text?: string; error?: string; loading: boolean }>({ loading: true });
    const format = sourceFormat(source);

    useEffect(() => {
        let active = true;
        let url: string | undefined;
        setState({ loading: true });
        void downloadSource(source.projectId ?? projectId, source.id).then(async (blob) => {
            if (!active) return;
            url = URL.createObjectURL(format === "pdf" ? blob.slice(0, blob.size, "application/pdf") : blob);
            if (format === "text") {
                const text = await blob.text();
                if (active) setState({ url, text, loading: false });
            } else {
                if (active) setState({ url, blob, loading: false });
            }
        }).catch(() => { if (active) setState({ error: "No se pudo abrir el archivo original. Comprueba tus permisos o vuelve a intentarlo.", loading: false }); });
        return () => { active = false; if (url) URL.revokeObjectURL(url); };
    }, [source.id, source.projectId, projectId, format]);

    return <div className="flu-source-preview">
        <div className="flu-source-preview-toolbar"><span>{source.status === "processing" ? "Flu3nce está procesando el contenido" : source.status === "failed" ? "Flu3nce no pudo extraer el contenido; el original sigue disponible" : "Archivo original"}</span><div>{format === "pdf" && state.url ? <a href={state.url} target="_blank" rel="noopener noreferrer" className="flu-source-download">Abrir aparte</a> : null}{state.url ? <a href={state.url} download={source.name} className="flu-source-download">Descargar original</a> : null}</div></div>
        {state.loading ? <p role="status" className="flu-source-preview-status">Abriendo archivo…</p> : state.error ? <p role="alert" className="flu-source-preview-status">{state.error}</p> : <>
            {format === "pdf" && state.blob ? <FluPdfDocument pdf={state.blob} edgeToEdge /> : null}
            {format === "docx" && state.blob ? <FluDocxViewer blob={state.blob} /> : null}
            {format === "text" ? <article className="flu-source-preview-text" aria-label={`Texto de ${source.name}`}>{state.text || "Este archivo no contiene texto visible."}</article> : null}
            {format === "audio" && state.url ? <audio controls preload="metadata" src={state.url} className="w-full">Tu navegador no puede reproducir este audio.</audio> : null}
            {format === "video" && state.url ? <video controls preload="metadata" src={state.url} className="flu-source-preview-video">Tu navegador no puede reproducir este video.</video> : null}
            {format === "other" ? <p className="flu-source-preview-status">Este formato no tiene vista integrada. Puedes descargar el original.</p> : null}
        </>}
    </div>;
}
