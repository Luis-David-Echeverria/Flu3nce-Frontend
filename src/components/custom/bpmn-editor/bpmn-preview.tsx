import { useEffect, useRef } from "react";
// @ts-ignore — bpmn-js expone tipos parciales; el viewer se usa dinámico.
import NavigatedViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import { fluModdleDescriptor } from "./flu-ext";

/**
 * Vista de solo lectura del diagrama (pan/zoom, sin edición). Renderiza el BPMN
 * tal cual — tambores, refs, colores por carril, todo nativo. Para editar se
 * abre el editor completo. Registra la extensión flu para parsear sin warnings.
 */
export function BpmnPreview({ xml, className, controls = false }: { xml: string; className?: string; controls?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<NavigatedViewer | null>(null);
    const fitRef = useRef<(() => void) | null>(null);

    const zoom = (factor: number) => {
        const canvas = viewerRef.current?.get("canvas") as { zoom: (value?: number) => number } | undefined;
        if (!canvas) return;
        canvas.zoom(Math.max(.2, Math.min(4, canvas.zoom() * factor)));
    };

    useEffect(() => {
        if (!ref.current || !xml) return;
        const viewer = new NavigatedViewer({
            container: ref.current,
            moddleExtensions: { flu: fluModdleDescriptor },
        });
        viewerRef.current = viewer;
        let disposed = false;
        let resizeObserver: ResizeObserver | undefined;
        const fit = () => {
            const canvas = viewer.get("canvas") as any;
            canvas.resized();
            // `fit-viewport` sin segundo argumento alinea el origen arriba/izquierda.
            // Un centro explícito conserva todo el diagrama y reparte el aire sobrante.
            canvas.zoom("fit-viewport", { x: 0, y: 0 });
        };
        fitRef.current = fit;
        viewer.importXML(xml)
            .then(() => {
                if (disposed || !ref.current) return;
                fit();
                resizeObserver = new ResizeObserver(fit);
                resizeObserver.observe(ref.current);
            })
            .catch((err: unknown) => {
                // React StrictMode monta/desmonta una primera instancia en desarrollo;
                // su importación puede terminar después de destroy(). No es un fallo del XML.
                if (!disposed) console.error("[BpmnPreview] importXML:", err);
            });
        return () => {
            disposed = true;
            resizeObserver?.disconnect();
            if (viewerRef.current === viewer) viewerRef.current = null;
            if (fitRef.current === fit) fitRef.current = null;
            viewer.destroy();
        };
    }, [xml]);

    const canvas = <div ref={ref} className={className} role="img" aria-label="Vista previa del diagrama BPMN" style={{ width: "100%", height: "100%" }} />;
    if (!controls) return canvas;
    return <div className="flu-diagram-interactive">{canvas}<div className="flu-diagram-zoom-controls" aria-label="Controles del diagrama"><button type="button" onClick={() => zoom(1.4)} aria-label="Acercar diagrama" title="Acercar">+</button><button type="button" onClick={() => zoom(1 / 1.4)} aria-label="Alejar diagrama" title="Alejar">−</button><button type="button" onClick={() => fitRef.current?.()} aria-label="Ajustar diagrama" title="Ver todo">⛶</button></div></div>;
}
