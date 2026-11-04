/**
 * Web Worker del pipeline BPMN (client-side). Corre el pipeline pesado (sobre
 * todo el auto-layout) fuera del hilo principal para no congelar la UI.
 * Expone: generate (Contrato A → BPMN), layout (auto-organizar), reref.
 * Réplica de la lógica del preview-server del Diagramador, sin Node.
 */
import { runPipeline } from "./pipeline/pipeline";
import { stripRefs, stripRefsKeepLayout } from "./pipeline/print/refs";
import { decideCuts } from "./pipeline/print/ref-cutter";
import { DiPrinter } from "./pipeline/print/printer";
import { defaultLayouter } from "./pipeline/layout/auto-layouter";
import { injectFlu, extractFlu, fluFromContract } from "./flu-ext";
import type { ContractA } from "./pipeline/contracts/contract-a";

/* eslint-disable @typescript-eslint/no-explicit-any */

async function generate(contract: ContractA, refMaxLenPx: number) {
    const res = await runPipeline(contract, { refMaxLenPx });
    // Los RCO vienen del Contrato A y se inyectan como flu:extensionElements.
    const xml = await injectFlu(res.xml, fluFromContract(contract));
    return { xml, refs: res.refs, warnings: res.warnings, stats: res.stats, pagination: res.pagination };
}

async function layout(xml: string, refMaxLenPx: number, forceRef: string[], forceLine: string[]) {
    const flu = await extractFlu(xml); // preservar RCO: el layouter re-serializa y los tira
    const clean = await stripRefs(xml);
    const { xml: laidOut, warnings } = await defaultLayouter.layout(clean);
    const auto = refMaxLenPx > 0 ? (await decideCuts(laidOut, refMaxLenPx)).edgeIds : new Set<string>();
    const cut = new Set<string>(auto);
    for (const id of forceRef) cut.add(id);
    for (const id of forceLine) cut.delete(id);
    const printer = new DiPrinter();
    const out = await printer.prepare(laidOut, cut);
    return { xml: await injectFlu(out.xml, flu), refs: out.refs, warnings };
}

async function reref(xml: string, refMaxLenPx: number, forceRef: string[], forceLine: string[]) {
    const flu = await extractFlu(xml); // idem: preservar RCO a través del printer
    const currentRefs = new Set([...xml.matchAll(/id="RefOut_([^"]+)"/g)].map((m) => m[1] as string));
    const allLines = await stripRefsKeepLayout(xml);
    const auto = refMaxLenPx > 0 ? (await decideCuts(allLines, refMaxLenPx)).edgeIds : new Set<string>();
    const cut = new Set<string>(auto);
    for (const id of forceRef) cut.add(id);
    for (const id of forceLine) cut.delete(id);
    const toRemove = new Set([...currentRefs].filter((id) => !cut.has(id)));
    const toAdd = new Set([...cut].filter((id) => !currentRefs.has(id)));
    const base = toRemove.size ? await stripRefsKeepLayout(xml, toRemove) : xml;
    const printer = new DiPrinter({ pagination: { enabled: false, pageSize: "carta", marginPx: 0 } } as any);
    const out = await printer.prepare(base, toAdd);
    const finalXml = await injectFlu(out.xml, flu);
    const total = new Set([...finalXml.matchAll(/id="RefOut_([^"]+)"/g)].map((m) => m[1]));
    return { xml: finalXml, refs: [...total].map((edgeId) => ({ edgeId })) };
}

const ctx = self as unknown as {
    postMessage: (m: unknown) => void;
    onmessage: ((e: MessageEvent) => void) | null;
};

ctx.onmessage = async (e: MessageEvent) => {
    const msg = e.data as any;
    try {
        let result: unknown;
        if (msg.op === "generate") result = await generate(msg.contract, msg.refMaxLenPx ?? 0);
        else if (msg.op === "layout") result = await layout(msg.xml, msg.refMaxLenPx ?? 0, msg.forceRef ?? [], msg.forceLine ?? []);
        else if (msg.op === "reref") result = await reref(msg.xml, msg.refMaxLenPx ?? 0, msg.forceRef ?? [], msg.forceLine ?? []);
        else throw new Error("op desconocida: " + msg.op);
        ctx.postMessage({ id: msg.id, ok: true, result });
    } catch (err) {
        ctx.postMessage({ id: msg.id, ok: false, error: (err as Error).message });
    }
};
