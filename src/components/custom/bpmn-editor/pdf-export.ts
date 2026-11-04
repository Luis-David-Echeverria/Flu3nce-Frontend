/**
 * Exportación a PDF del diagrama con anexos opcionales: una hoja de SIMBOLOGÍA
 * y una hoja de MATRIZ RCO. Todo se dibuja con jsPDF (sin depender de HTML).
 */
import { jsPDF } from "jspdf";
import "svg2pdf.js"; // parchea jsPDF con .svg()
import type { ContractA, ProcessNode, RcoItem } from "./pipeline/contracts/contract-a";

/* eslint-disable @typescript-eslint/no-explicit-any */

const NAVY: [number, number, number] = [26, 62, 127];
const SLATE: [number, number, number] = [71, 85, 105];
const RED: [number, number, number] = [220, 38, 38];
const BLUE: [number, number, number] = [37, 99, 235];
const GREEN: [number, number, number] = [22, 163, 74];

export interface RcoMark {
    x: number; y: number; w: number; h: number;
    nRisk: number; nCtrl: number; nOpp: number;
}

export interface ExportPdfOptions {
    /** SVG del diagrama; si se omite, el PDF sólo lleva los anexos. */
    svg?: string;
    /** Badges RCO (overlays, no van en el SVG) para dibujarlos sobre el diagrama. */
    marks?: RcoMark[];
    contract?: ContractA;
    symbology?: boolean;
    rco?: boolean;
    fileName: string;
}

export async function exportDiagramPdf(opts: ExportPdfOptions): Promise<void> {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4", compress: true });
    let first = true;
    const page = () => { if (!first) doc.addPage(); first = false; };

    if (opts.svg) { page(); await drawDiagram(doc, opts.svg, opts.marks ?? []); }
    if (opts.symbology) { page(); drawSymbology(doc); }
    if (opts.rco && opts.contract) { page(); drawRco(doc, opts.contract); }
    if (first) { page(); } // nada seleccionado → hoja en blanco (evita PDF vacío)
    doc.save(opts.fileName);
}

// ── Diagrama ──
async function drawDiagram(doc: jsPDF, svg: string, marks: RcoMark[]): Promise<void> {
    const holder = document.createElement("div");
    holder.style.cssText = "position:fixed;left:-99999px;top:0";
    holder.innerHTML = svg;
    document.body.appendChild(holder);
    try {
        const svgEl = holder.querySelector("svg") as SVGSVGElement;
        const vb = (svgEl.getAttribute("viewBox") || "").split(/\s+/).map(Number);
        let w = parseFloat(svgEl.getAttribute("width") || "");
        let h = parseFloat(svgEl.getAttribute("height") || "");
        if (!w || !h) { w = vb[2] || 1000; h = vb[3] || 700; }
        const minX = vb[0] || 0, minY = vb[1] || 0;
        const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), m = 24;
        const scale = Math.min((pw - m * 2) / w, (ph - m * 2) / h);
        await (doc as any).svg(svgEl, { x: m, y: m, width: w * scale, height: h * scale });

        // Badges RCO (overlays HTML → se dibujan aquí, en coords del PDF).
        const ms = Math.max(6, Math.min(11, 15 * scale)), gap = ms * 0.3;
        for (const mk of marks) {
            const present: Array<["risk" | "ctrl" | "opp", number]> = [];
            if (mk.nRisk) present.push(["risk", mk.nRisk]);
            if (mk.nCtrl) present.push(["ctrl", mk.nCtrl]);
            if (mk.nOpp) present.push(["opp", mk.nOpp]);
            if (!present.length) continue;
            const rightX = m + (mk.x + mk.w - minX) * scale;
            const cy = m + (mk.y - minY) * scale - ms * 0.55;
            let cx = rightX - ms / 2;
            for (let i = present.length - 1; i >= 0; i--) {
                drawRcoMark(doc, cx, cy, present[i][0], present[i][1], ms);
                cx -= ms + gap;
            }
        }
    } finally {
        holder.remove();
    }
}

function drawRcoMark(doc: jsPDF, cx: number, cy: number, kind: "risk" | "ctrl" | "opp", n: number, s: number): void {
    const r = s / 2;
    if (kind === "risk") { doc.setFillColor(...RED); (doc as any).triangle(cx, cy - r, cx + r, cy + r * 0.85, cx - r, cy + r * 0.85, "F"); }
    else if (kind === "ctrl") { doc.setFillColor(...BLUE); (doc as any).lines([[r, r], [-r, r], [-r, -r], [r, -r]], cx, cy - r, [1, 1], "F", true); }
    else { doc.setFillColor(...GREEN); doc.circle(cx, cy, r, "F"); }
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(s * 0.55);
    doc.text(String(n), cx, cy + (kind === "risk" ? r * 0.55 : s * 0.19), { align: "center" });
}

// ── Simbología ──
function drawSymbology(doc: jsPDF): void {
    const pw = doc.internal.pageSize.getWidth();
    const M = 44;
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...NAVY);
    doc.text("Simbología", M, M + 4);

    const colX = [M, pw / 2 + 10];
    let y = M + 34;
    const rowH = 26;

    const label = (x: number, yy: number, t: string) => { doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(...SLATE); doc.text(t, x + 34, yy + 4); };
    const heading = (x: number, yy: number, t: string) => { doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(148, 163, 184); doc.text(t.toUpperCase(), x, yy); };

    // Columna 1: Formas
    heading(colX[0], y, "Formas"); y += 14;
    const shapes: Array<[(x: number, yy: number) => void, string]> = [
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setLineWidth(1); doc.circle(x + 12, yy, 8, "S"); }, "Inicio"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setLineWidth(2.4); doc.circle(x + 12, yy, 8, "S"); }, "Fin"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setLineWidth(1); doc.roundedRect(x, yy - 8, 24, 16, 3, 3, "S"); }, "Tarea"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setFillColor(226, 232, 240); doc.roundedRect(x, yy - 8, 24, 16, 3, 3, "FD"); }, "Tarea de usuario / sistema"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setLineWidth(1); diamond(doc, x + 12, yy, 9, "S"); }, "Decisión (exclusiva)"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); diamond(doc, x + 12, yy, 9, "S"); doc.setLineWidth(1.4); doc.line(x + 12, yy - 4, x + 12, yy + 4); doc.line(x + 8, yy, x + 16, yy); }, "Paralela (simultáneo)"],
        [(x, yy) => { doc.setDrawColor(51, 65, 85); doc.setFillColor(241, 245, 249); cylinder(doc, x + 2, yy - 9, 20, 18); }, "Base de datos / sistema"],
    ];
    for (const [draw, t] of shapes) { draw(colX[0], y + 4); label(colX[0], y, t); y += rowH; }

    // Columna 2: Conectores + Análisis
    y = M + 48;
    heading(colX[1], y, "Conectores"); y += 14;
    doc.setDrawColor(51, 65, 85); doc.setLineWidth(1.2);
    // flujo de secuencia
    arrow(doc, colX[1], y + 4, colX[1] + 26, y + 4, false); label(colX[1], y, "Flujo de secuencia"); y += rowH;
    // asociación de datos (punteada)
    arrow(doc, colX[1], y + 4, colX[1] + 26, y + 4, true); label(colX[1], y, "Uso de sistema (lee / escribe)"); y += rowH;
    // ref
    doc.setDrawColor(51, 65, 85); doc.setLineWidth(1); doc.circle(colX[1] + 12, y + 4, 8, "S"); doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(51, 65, 85); doc.text("A", colX[1] + 12, y + 7, { align: "center" }); label(colX[1], y, "Conector fuera de página (A)"); y += rowH + 6;

    heading(colX[1], y, "Análisis"); y += 14;
    mark(doc, colX[1] + 12, y + 4, "risk"); label(colX[1], y, "Riesgo"); y += rowH;
    mark(doc, colX[1] + 12, y + 4, "ctrl"); label(colX[1], y, "Control"); y += rowH;
    mark(doc, colX[1] + 12, y + 4, "opp"); label(colX[1], y, "Oportunidad"); y += rowH;
}

// ── Matriz RCO ──
function drawRco(doc: jsPDF, contract: ContractA): void {
    const rows = (contract.nodes ?? []).filter((n) => n.risks?.length || n.controls?.length || n.opportunities?.length);
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight(), M = 40;
    const usable = pw - 2 * M;
    const cols = [
        { x: M, w: usable * 0.31, title: "Actividad", color: SLATE, items: (_n: ProcessNode) => null as RcoItem[] | null },
        { x: 0, w: usable * 0.23, title: "Riesgos", color: RED, items: (n: ProcessNode) => n.risks ?? [] },
        { x: 0, w: usable * 0.23, title: "Controles", color: BLUE, items: (n: ProcessNode) => n.controls ?? [] },
        { x: 0, w: usable * 0.23, title: "Oportunidades", color: GREEN, items: (n: ProcessNode) => n.opportunities ?? [] },
    ];
    cols.forEach((c, i) => { if (i > 0) c.x = cols[i - 1].x + cols[i - 1].w; });

    let y = M;
    const header = () => {
        doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...NAVY);
        doc.text("Riesgos, controles y oportunidades", M, y + 2); y += 22;
        doc.setFontSize(9);
        for (const c of cols) { doc.setTextColor(...(c.color as [number, number, number])); doc.text(c.title, c.x + 4, y); }
        y += 6; doc.setDrawColor(203, 213, 225); doc.setLineWidth(1); doc.line(M, y, pw - M, y); y += 8;
    };
    header();

    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    const lh = 11;
    const cellLines = (items: RcoItem[] | null, name?: string): string[][] => {
        if (items === null) return [doc.splitTextToSize(name || "", cols[0].w - 8)];
        return items.length ? items.map((it) => doc.splitTextToSize((it.code ? it.code + "  " : "") + it.text, cols[1].w - 8)) : [["—"]];
    };

    for (const n of rows) {
        const cells = [cellLines(null, n.name), cellLines(n.risks ?? []), cellLines(n.controls ?? []), cellLines(n.opportunities ?? [])];
        const rowLines = Math.max(...cells.map((c) => c.reduce((a, b) => a + b.length, 0)));
        const rowH = rowLines * lh + 8;
        if (y + rowH > ph - M) { doc.addPage(); y = M; header(); doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); }

        cols.forEach((c, ci) => {
            let ty = y + 8;
            doc.setTextColor(ci === 0 ? 26 : 51, ci === 0 ? 62 : 65, ci === 0 ? 127 : 85);
            if (ci === 0) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal");
            for (const block of cells[ci]) {
                for (const line of block) { doc.text(line, c.x + 4, ty); ty += lh; }
            }
        });
        y += rowH; doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.7); doc.line(M, y, pw - M, y); y += 2;
    }
}

// ── primitivas ──
function diamond(doc: jsPDF, cx: number, cy: number, r: number, style: string): void {
    (doc as any).lines([[r, r], [-r, r], [-r, -r], [r, -r]], cx, cy - r, [1, 1], style, true);
}
function cylinder(doc: jsPDF, x: number, y: number, w: number, h: number): void {
    const ry = 4;
    doc.ellipse(x + w / 2, y + ry, w / 2, ry, "FD");
    doc.line(x, y + ry, x, y + h - ry); doc.line(x + w, y + ry, x + w, y + h - ry);
    (doc as any).ellipse(x + w / 2, y + h - ry, w / 2, ry, "S");
}
function arrow(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, dashed: boolean): void {
    doc.setDrawColor(51, 65, 85); doc.setLineWidth(1.2);
    if (dashed) (doc as any).setLineDashPattern([2, 2], 0);
    doc.line(x1, y1, x2 - 4, y2);
    (doc as any).setLineDashPattern([], 0);
    doc.line(x2 - 5, y2 - 3, x2, y2); doc.line(x2 - 5, y2 + 3, x2, y2);
}
function mark(doc: jsPDF, cx: number, cy: number, kind: "risk" | "ctrl" | "opp"): void {
    if (kind === "risk") { doc.setFillColor(...RED); (doc as any).triangle(cx, cy - 6, cx + 6, cy + 5, cx - 6, cy + 5, "F"); }
    else if (kind === "ctrl") { doc.setFillColor(...BLUE); (doc as any).lines([[6, 6], [-6, 6], [-6, -6], [6, -6]], cx, cy - 6, [1, 1], "F", true); }
    else { doc.setFillColor(...GREEN); doc.circle(cx, cy, 5.5, "F"); }
}
