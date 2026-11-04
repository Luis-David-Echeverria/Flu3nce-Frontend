/**
 * Wrapper de promesas sobre el Web Worker del pipeline BPMN.
 * Todo corre client-side (sin backend Node): generar desde Contrato A,
 * auto-organizar (layout) y recalcular refs.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

let worker: Worker | null = null;
function getWorker(): Worker {
    if (!worker) {
        worker = new Worker(new URL("./bpmn-pipeline.worker.ts", import.meta.url), { type: "module" });
    }
    return worker;
}

let seq = 0;
function call<T>(op: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const id = ++seq;
        const w = getWorker();
        const onMsg = (e: MessageEvent) => {
            const d = e.data as any;
            if (!d || d.id !== id) return;
            w.removeEventListener("message", onMsg);
            if (d.ok) resolve(d.result as T);
            else reject(new Error(d.error || "Error en el pipeline"));
        };
        w.addEventListener("message", onMsg);
        w.postMessage({ id, op, ...payload });
    });
}

export interface GenerateResult {
    xml: string;
    refs: unknown[];
    warnings: string[];
    stats: { nodes: number; edges: number; lanes: number };
    pagination: unknown;
}
export interface LayoutResult { xml: string; refs: unknown[]; warnings: string[] }
export interface RerefResult { xml: string; refs: { edgeId: string }[] }

export const bpmnPipeline = {
    /** Contrato A (JSON) → BPMN 2.0 + DI. */
    generate: (contract: unknown, refMaxLenPx = 0) => call<GenerateResult>("generate", { contract, refMaxLenPx }),
    /** Auto-organiza el diagrama editado (revierte refs → re-layout → re-aplica). */
    layout: (xml: string, refMaxLenPx = 0, forceRef: string[] = [], forceLine: string[] = []) =>
        call<LayoutResult>("layout", { xml, refMaxLenPx, forceRef, forceLine }),
    /** Recalcula refs sobre el diagrama actual (preserva ediciones). */
    reref: (xml: string, refMaxLenPx = 0, forceRef: string[] = [], forceLine: string[] = []) =>
        call<RerefResult>("reref", { xml, refMaxLenPx, forceRef, forceLine }),
};
