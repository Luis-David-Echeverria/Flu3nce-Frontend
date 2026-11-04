import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
// @ts-ignore — bpmn-js expone tipos parciales; el Modeler se usa dinámico.
import BpmnModeler from "bpmn-js/lib/Modeler";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "./bpmn-editor.css";
import ColorContextPadModule from "./modules/color-context-pad";
import LabelTruncateModule from "./modules/label-truncate";
import RefJumpModule from "./modules/ref-jump";
import TranslateESModule from "./modules/translate-es";
import ContextPadVisibleModule from "./modules/context-pad-visible";
import RefToggleModule from "./modules/ref-toggle-context-pad";
import FluViewPaletteModule from "./modules/flu-view-palette";
import RestrictVocabularyModule from "./modules/restrict-vocabulary";
import { fluModdleDescriptor, type FluData } from "./flu-ext";
import { bpmnToContract } from "./bpmn-to-contract";
import type { ContractA } from "./pipeline/contracts/contract-a";
import { bpmnPipeline } from "./bpmn-pipeline";
import { jsPDF } from "jspdf";
import "svg2pdf.js"; // parchea jsPDF con .svg()

/* eslint-disable @typescript-eslint/no-explicit-any */

// Umbral de refs automáticas por distancia (0 = solo refs manuales por toggle).
const REF_MAX_LEN = 0;

// Paleta de colores por carril (se cicla si hay más lanes).
const LANE_PALETTE = [
    { fill: "#E3F2FD", stroke: "#1565C0" },
    { fill: "#E8F5E9", stroke: "#2E7D32" },
    { fill: "#FFF3E0", stroke: "#E65100" },
    { fill: "#F3E5F5", stroke: "#6A1B9A" },
    { fill: "#FCE4EC", stroke: "#AD1457" },
    { fill: "#E0F7FA", stroke: "#00838F" },
    { fill: "#FFF9C4", stroke: "#F9A825" },
];

export interface BpmnEditorHandle {
    getXml: () => Promise<string>;
    /** Proyección lógica del diagrama actual (Contrato A, sin geometría). */
    getContract: () => Promise<ContractA>;
    loadXml: (xml: string) => Promise<void>;
    fit: () => void;
    zoom: (delta: number) => void;
    /** Selecciona y centra una actividad por id (desde la Matriz RCO). */
    selectElement: (id: string) => void;
    exportPdf: (fileName?: string) => Promise<void>;
    /** SVG del diagrama actual (para armar el PDF con anexos). */
    getSvg: () => Promise<string>;
    /** Actividades con RCO: bounds + conteos, para dibujar los badges en el PDF. */
    getRcoMarks: () => { x: number; y: number; w: number; h: number; nRisk: number; nCtrl: number; nOpp: number }[];
    /** Contrato A (JSON) → BPMN (worker) y lo carga. */
    generate: (contract: unknown) => Promise<void>;
    /** Auto-organiza el diagrama editado (worker), preservando ediciones y colores. */
    autoLayout: () => Promise<void>;
    /** Activa/desactiva el auto-coloreo por carril. */
    setLaneColors: (on: boolean) => void;
    /** Activa/desactiva el numerado automático de actividades (según el flujo). */
    setNumbering: (on: boolean) => void;
    /** Muestra/oculta los badges de riesgos, controles y oportunidades (RCO). */
    setRiskBadges: (on: boolean) => void;
}

interface BpmnEditorProps {
    xml: string;
    onChange?: () => void;
    onBusy?: (msg: string | null) => void;
    className?: string;
}

export const BpmnEditor = forwardRef<BpmnEditorHandle, BpmnEditorProps>(({ xml, onChange, onBusy, className }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modelerRef = useRef<any>(null);
    // Overrides persistentes de refs (línea↔ref) y estado del auto-coloreo.
    const forcedRef = useRef<Set<string>>(new Set());
    const forcedLine = useRef<Set<string>>(new Set());
    const manualColors = useRef<Set<string>>(new Set());
    const autoColored = useRef<Map<string, { fill?: string; stroke?: string }> | null>(null);
    const colorSource = useRef<"auto" | "manual">("manual");
    const colorsOn = useRef(false);
    // Numerado automático de actividades.
    const numberingOn = useRef(false);
    const renumberingRef = useRef(false);
    const renumberTimer = useRef<number | null>(null);
    const vbAnim = useRef<number | null>(null);
    const badgesOn = useRef(false);
    const onBusyRef = useRef(onBusy); onBusyRef.current = onBusy;
    const onChangeRef = useRef(onChange); onChangeRef.current = onChange;

    // ── Auto-coloreo por carril (respeta colores manuales del usuario) ──
    function colorableNodes(): any[] {
        return modelerRef.current.get("elementRegistry").filter((e: any) =>
            e.businessObject && /Task|Event|Gateway/.test(e.type) && e.type !== "label");
    }
    function currentColorOf(node: any) {
        const bo = node.businessObject.di || node.businessObject;
        return {
            fill: bo.get ? bo.get("bioc:fill") : bo["bioc:fill"],
            stroke: bo.get ? bo.get("bioc:stroke") : bo["bioc:stroke"],
        };
    }
    function applyLaneColors() {
        const er = modelerRef.current.get("elementRegistry");
        const modeling = modelerRef.current.get("modeling");
        const lanes = er.filter((e: any) => e.type === "bpmn:Lane").sort((a: any, b: any) => (a.y ?? 0) - (b.y ?? 0));
        const laneColor = new Map<string, { fill: string; stroke: string }>();
        lanes.forEach((lane: any, i: number) => laneColor.set(lane.id, LANE_PALETTE[i % LANE_PALETTE.length]));
        autoColored.current = new Map();
        const byColor = new Map<string, { color: any; nodes: any[] }>();
        for (const node of colorableNodes()) {
            if (manualColors.current.has(node.id)) continue;
            const cx = node.x + node.width / 2, cy = node.y + node.height / 2;
            const lane = lanes.find((l: any) => cx >= l.x && cx <= l.x + l.width && cy >= l.y && cy <= l.y + l.height);
            const color = lane ? laneColor.get(lane.id) : null;
            if (!color) continue;
            autoColored.current.set(node.id, currentColorOf(node));
            const key = color.fill + "|" + color.stroke;
            if (!byColor.has(key)) byColor.set(key, { color, nodes: [] });
            byColor.get(key)!.nodes.push(node);
        }
        colorSource.current = "auto";
        for (const { color, nodes } of byColor.values()) modeling.setColor(nodes, color);
        colorSource.current = "manual";
    }
    function clearLaneColors() {
        if (!autoColored.current) return;
        const modeling = modelerRef.current.get("modeling");
        const er = modelerRef.current.get("elementRegistry");
        const byColor = new Map<string, { color: any; nodes: any[] }>();
        for (const [id, prev] of autoColored.current) {
            const node = er.get(id);
            if (!node || manualColors.current.has(id)) continue;
            const key = (prev.fill || "") + "|" + (prev.stroke || "");
            if (!byColor.has(key)) byColor.set(key, { color: { fill: prev.fill, stroke: prev.stroke }, nodes: [] });
            byColor.get(key)!.nodes.push(node);
        }
        colorSource.current = "auto";
        for (const { color, nodes } of byColor.values()) modeling.setColor(nodes, color);
        colorSource.current = "manual";
        autoColored.current = null;
    }

    async function importAndColor(x: string, preserveViewbox = false) {
        const canvas = modelerRef.current.get("canvas");
        const prev = preserveViewbox ? canvas.viewbox() : null;
        await modelerRef.current.importXML(x);
        if (prev) canvas.viewbox({ x: prev.x, y: prev.y, width: prev.width, height: prev.height });
        else canvas.zoom("fit-viewport");
        if (colorsOn.current) applyLaneColors();
        if (numberingOn.current) renumberNow();
        if (badgesOn.current) applyRiskBadges();
        // Entrada en fade cuando llega contenido nuevo (no en reref/auto-organizar).
        const c = containerRef.current;
        if (c && !preserveViewbox && !reduceMotion()) {
            c.classList.remove("flu-enter");
            void c.offsetWidth; // reflow para re-disparar la animación
            c.classList.add("flu-enter");
        }
    }

    // ── Numerado automático de actividades (según el flujo) ──
    function isActivity(n: any): boolean {
        const t = n?.businessObject?.$type;
        return !!t && (/Task$/.test(t) || t === "bpmn:SubProcess" || t === "bpmn:CallActivity") && n.type !== "label";
    }
    function baseName(el: any): string {
        return (el.businessObject?.name || "").replace(/^\s*\d+\.(?:\s+|$)/, "");
    }
    function activities(): any[] {
        return modelerRef.current.get("elementRegistry").filter((e: any) => isActivity(e));
    }
    // Orden de lectura: recorre el flujo (BFS) desde los eventos de inicio.
    function computeActivityOrder(): any[] {
        const er = modelerRef.current.get("elementRegistry");
        const byPos = (a: any, b: any) => (a.x - b.x) || (a.y - b.y);
        const isFlow = (c: any) => c?.businessObject?.$type === "bpmn:SequenceFlow";
        const shapes = er.filter((e: any) => e.businessObject && !e.waypoints && e.type !== "label");
        const starts = shapes.filter((s: any) => /StartEvent/.test(s.type)).sort(byPos);
        const roots = (starts.length ? starts
            : shapes.filter((s: any) => (s.incoming || []).filter(isFlow).length === 0)).sort(byPos);
        const visited = new Set<string>();
        const order: any[] = [];
        const queue = [...roots];
        while (queue.length) {
            const n = queue.shift();
            if (!n || visited.has(n.id)) continue;
            visited.add(n.id);
            if (isActivity(n)) order.push(n);
            const outs = (n.outgoing || []).filter(isFlow).map((c: any) => c.target).filter(Boolean).sort(byPos);
            for (const t of outs) if (!visited.has(t.id)) queue.push(t);
        }
        const rest = shapes.filter((s: any) => isActivity(s) && !visited.has(s.id)).sort(byPos);
        return [...order, ...rest];
    }
    function renumberNow() {
        const modeling = modelerRef.current.get("modeling");
        const order = computeActivityOrder();
        renumberingRef.current = true;
        try {
            order.forEach((el, i) => {
                const base = baseName(el);
                const desired = base ? `${i + 1}. ${base}` : `${i + 1}.`;
                if ((el.businessObject?.name || "") !== desired) modeling.updateLabel(el, desired);
            });
        } finally { renumberingRef.current = false; }
    }
    function stripNumbers() {
        const modeling = modelerRef.current.get("modeling");
        renumberingRef.current = true;
        try {
            for (const el of activities()) {
                const base = baseName(el);
                if ((el.businessObject?.name || "") !== base) modeling.updateLabel(el, base);
            }
        } finally { renumberingRef.current = false; }
    }
    // Renumera tras un lote de cambios (agregar/conectar actividades), sin re-entrar.
    function scheduleRenumber() {
        if (!numberingOn.current || renumberingRef.current || renumberTimer.current != null) return;
        renumberTimer.current = window.setTimeout(() => { renumberTimer.current = null; renumberNow(); }, 40);
    }

    // ── Badges de riesgos / controles / oportunidades (overlays HTML de bpmn-js) ──
    // Los datos viven en flu:extensionElements del businessObject; el badge es
    // solo presentación de Fluence (no toca el modelo BPMN estándar).
    function readFlu(el: any): FluData | null {
        const values = el.businessObject?.extensionElements?.get?.("values")
            ?? el.businessObject?.extensionElements?.values;
        const metas = ((values as any[]) ?? []).filter((v) => v.$type === "flu:Meta");
        if (!metas.length) return null;
        const data: FluData = { risks: [], controls: [], opportunities: [] };
        for (const m of metas) {
            for (const it of ((m.items as any[]) ?? [])) {
                const key = it.kind === "control" ? "controls" : it.kind === "opportunity" ? "opportunities" : "risks";
                (data[key as keyof FluData] as any[]).push({ code: it.code, text: it.text });
            }
        }
        return (data.risks.length || data.controls.length || data.opportunities.length) ? data : null;
    }
    function escAttr(s: string): string {
        return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
    // Badges RCO como figuras SVG con el CONTEO en blanco: ▲ riesgo (rojo, esquinas
    // redondeadas), ◆ control (azul, redondeado), ● oportunidad (verde). Click en el
    // badge → abre la Matriz RCO en esa actividad (window.fluenceShowRco).
    function badgeHtml(flu: FluData, id: string): string {
        const lines = (label: string, arr: { code?: string; text: string }[]) =>
            arr.length ? [label + ":", ...arr.map((i) => "• " + (i.code ? i.code + " " : "") + i.text)] : [];
        const tip = escAttr([...lines("Riesgos", flu.risks), ...lines("Controles", flu.controls), ...lines("Oportunidades", flu.opportunities)].join("\n"));
        const num = (n: number) => `<text x="8" y="10.6" text-anchor="middle" font-size="7" font-weight="700" fill="#fff">${n}</text>`;
        const tri = (n: number) => `<svg class="flu-badge-svg" viewBox="0 0 16 16" width="16" height="16"><path d="M8 2.6 L14.4 13.4 L1.6 13.4 Z" fill="#dc2626" stroke="#dc2626" stroke-width="2" stroke-linejoin="round"/><text x="8" y="12.4" text-anchor="middle" font-size="6.5" font-weight="700" fill="#fff">${n}</text></svg>`;
        const dia = (n: number) => `<svg class="flu-badge-svg" viewBox="0 0 16 16" width="16" height="16"><path d="M8 1.6 L14.4 8 L8 14.4 L1.6 8 Z" fill="#2563eb" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>${num(n)}</svg>`;
        const cir = (n: number) => `<svg class="flu-badge-svg" viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="6.6" fill="#16a34a"/>${num(n)}</svg>`;
        const parts = [
            flu.risks.length ? tri(flu.risks.length) : "",
            flu.controls.length ? dia(flu.controls.length) : "",
            flu.opportunities.length ? cir(flu.opportunities.length) : "",
        ].join("");
        return `<div class="flu-badges" title="${tip}" onclick="window.fluenceShowRco&&window.fluenceShowRco('${id}')">${parts}</div>`;
    }
    function applyRiskBadges() {
        const overlays = modelerRef.current.get("overlays");
        overlays.remove({ type: "flu-badge" });
        for (const el of modelerRef.current.get("elementRegistry").getAll()) {
            if (!el.businessObject || el.waypoints || el.type === "label") continue;
            const flu = readFlu(el);
            if (!flu) continue;
            overlays.add(el.id, "flu-badge", {
                // Van ARRIBA de la caja (top negativo = sobresalen por encima). Contenedor de
                // ancho fijo (54px) alineado a la derecha → no pasan el borde derecho.
                position: { top: -20, right: 56 },
                html: badgeHtml(flu, el.id as string),
                scale: true, // escala con el diagrama; no desborda a la derecha
            });
        }
    }
    function clearRiskBadges() {
        modelerRef.current?.get("overlays").remove({ type: "flu-badge" });
    }

    // ── Zoom/pan suave ──
    // Recibe una acción que fija el viewbox destino de golpe; captura inicio y
    // destino en el mismo turno (sin repintar) y anima entre ambos.
    const reduceMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    function animateViewbox(applyInstant: () => void, duration = 320) {
        const canvas = modelerRef.current?.get("canvas");
        if (!canvas) return;
        const s = canvas.viewbox();
        const start = { x: s.x, y: s.y, width: s.width, height: s.height };
        applyInstant();
        const t = canvas.viewbox();
        const target = { x: t.x, y: t.y, width: t.width, height: t.height };
        if (reduceMotion()) return; // ya quedó en destino
        canvas.viewbox(start); // revertir (aún no se repinta)
        if (vbAnim.current) cancelAnimationFrame(vbAnim.current);
        const t0 = performance.now();
        const ease = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
        const step = (now: number) => {
            const p = Math.min(1, (now - t0) / duration);
            const k = ease(p);
            canvas.viewbox({
                x: start.x + (target.x - start.x) * k,
                y: start.y + (target.y - start.y) * k,
                width: start.width + (target.width - start.width) * k,
                height: start.height + (target.height - start.height) * k,
            });
            vbAnim.current = p < 1 ? requestAnimationFrame(step) : null;
        };
        vbAnim.current = requestAnimationFrame(step);
    }

    // Recalcula refs sobre el diagrama actual (preserva ediciones), vía worker.
    // Mantiene zoom/posición para no romper el efecto al pasar de línea a ref y viceversa.
    async function doReref() {
        onBusyRef.current?.("Recalculando referencias…");
        try {
            const { xml: current } = await modelerRef.current.saveXML({ format: true });
            const res = await bpmnPipeline.reref(current, REF_MAX_LEN, [...forcedRef.current], [...forcedLine.current]);
            await importAndColor(res.xml, true);
        } catch (err) {
            console.error("[BpmnEditor] reref:", err);
        } finally {
            onBusyRef.current?.(null);
        }
    }

    useEffect(() => {
        if (!containerRef.current) return;
        const modeler = new BpmnModeler({
            container: containerRef.current,
            keyboard: { bindTo: document },
            additionalModules: [
                ColorContextPadModule, LabelTruncateModule, RefJumpModule,
                TranslateESModule, ContextPadVisibleModule, RefToggleModule,
                FluViewPaletteModule, RestrictVocabularyModule,
            ],
            moddleExtensions: { flu: fluModdleDescriptor },
        });
        modelerRef.current = modeler;

        void importAndColor(xml).catch((err: unknown) => console.error("[BpmnEditor] importXML:", err));

        // Marca los nodos que el usuario coloreó a mano (para respetarlos en el auto-coloreo).
        modeler.on("commandStack.element.setColor.postExecuted", (e: any) => {
            const ctx = e.context || {};
            const els = ctx.elements || (ctx.element ? [ctx.element] : []);
            if (colorSource.current !== "auto") for (const el of els) if (el && el.id) manualColors.current.add(el.id);
        });

        // Señal de cambio (SIN saveXML → editar es fluido) + renumerado automático.
        modeler.on("commandStack.changed", () => { onChangeRef.current?.(); scheduleRenumber(); });

        // El menú (context-pad) de una conexión aparece donde se hizo clic, no en el
        // último waypoint. Guardamos el clic en coordenadas de diagrama y reproyectamos
        // en _getPosition (así también sigue al hacer pan/zoom con el menú abierto).
        let lastEdgeClick: { x: number; y: number; id: string } | null = null;
        modeler.on("element.click", (e: any) => {
            const el = e.element, oe = e.originalEvent as MouseEvent | undefined;
            if (!el || !el.waypoints || !oe) { lastEdgeClick = null; return; }
            const canvas = modeler.get("canvas") as any;
            const vb = canvas.viewbox();
            const rect = canvas.getContainer().getBoundingClientRect();
            lastEdgeClick = {
                x: (oe.clientX - rect.left) / vb.scale + vb.x,
                y: (oe.clientY - rect.top) / vb.scale + vb.y,
                id: el.id,
            };
        });
        const CONTEXT_PAD_MARGIN = 8;
        const contextPad = modeler.get("contextPad") as any;
        const origGetPosition = contextPad._getPosition.bind(contextPad);
        contextPad._getPosition = function (target: any) {
            if (target && !Array.isArray(target) && target.waypoints && lastEdgeClick && lastEdgeClick.id === target.id) {
                const vb = this._canvas.viewbox();
                return {
                    left: (lastEdgeClick.x - vb.x) * vb.scale + CONTEXT_PAD_MARGIN * this._canvas.zoom(),
                    top: (lastEdgeClick.y - vb.y) * vb.scale,
                };
            }
            return origGetPosition(target);
        };

        // Toggle línea↔ref desde el context-pad.
        (window as any).fluenceToggleRef = (edgeId: string, toRef: boolean) => {
            if (toRef) { forcedRef.current.add(edgeId); forcedLine.current.delete(edgeId); }
            else { forcedLine.current.add(edgeId); forcedRef.current.delete(edgeId); }
            void doReref();
        };
        // El salto a la ref pareja (Alt+clic) también anima el viewbox.
        (window as any).fluenceAnimateViewbox = (applyInstant: () => void) => animateViewbox(applyInstant);
        // Íconos de VISTA de la paleta (numerar / colorear / marcar RCO) con estado activo.
        const syncActive = (action: string, on: boolean) =>
            containerRef.current?.querySelector(`.djs-palette [data-action="${action}"]`)?.classList.toggle("flu-active", on);
        (window as any).fluenceToggleNumbering = () => {
            numberingOn.current = !numberingOn.current;
            if (numberingOn.current) renumberNow(); else stripNumbers();
            syncActive("flu-numbering", numberingOn.current);
        };
        (window as any).fluenceToggleColors = () => {
            colorsOn.current = !colorsOn.current;
            if (colorsOn.current) applyLaneColors(); else clearLaneColors();
            syncActive("flu-colors", colorsOn.current);
        };
        (window as any).fluenceToggleBadges = () => {
            badgesOn.current = !badgesOn.current;
            if (badgesOn.current) applyRiskBadges(); else clearRiskBadges();
            syncActive("flu-badges", badgesOn.current);
        };

        return () => {
            delete (window as any).fluenceToggleRef;
            delete (window as any).fluenceAnimateViewbox;
            delete (window as any).fluenceToggleNumbering;
            delete (window as any).fluenceToggleColors;
            delete (window as any).fluenceToggleBadges;
            if (vbAnim.current) cancelAnimationFrame(vbAnim.current);
            modeler.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, (): BpmnEditorHandle => ({
        getXml: async () => (await modelerRef.current.saveXML({ format: true })).xml,
        getContract: async () => bpmnToContract((await modelerRef.current.saveXML({ format: true })).xml),
        loadXml: async (x) => { await importAndColor(x); },
        fit: () => animateViewbox(() => modelerRef.current?.get("canvas").zoom("fit-viewport")),
        zoom: (delta) => animateViewbox(() => {
            const canvas = modelerRef.current?.get("canvas");
            if (canvas) canvas.zoom(Math.max(0.2, Math.min(4, canvas.zoom() + delta)));
        }),
        selectElement: (id) => {
            const el = modelerRef.current?.get("elementRegistry").get(id);
            if (!el) return;
            try { modelerRef.current.get("selection").select(el); } catch { /* noop */ }
            animateViewbox(() => {
                try { modelerRef.current.get("canvas").scrollToElement(el, { top: 140, right: 140, bottom: 140, left: 140 }); }
                catch { /* noop */ }
            });
        },
        generate: async (contract) => {
            onBusyRef.current?.("Generando el diagrama…");
            try {
                forcedRef.current.clear(); forcedLine.current.clear();
                manualColors.current.clear(); autoColored.current = null;
                const { xml: out } = await bpmnPipeline.generate(contract, REF_MAX_LEN);
                await importAndColor(out);
            } finally { onBusyRef.current?.(null); }
        },
        autoLayout: async () => {
            onBusyRef.current?.("Reorganizando el diagrama… (puede tardar en procesos densos)");
            try {
                const { xml: current } = await modelerRef.current.saveXML({ format: true });
                const res = await bpmnPipeline.layout(current, REF_MAX_LEN, [...forcedRef.current], [...forcedLine.current]);
                await importAndColor(res.xml, true);
            } finally { onBusyRef.current?.(null); }
        },
        setLaneColors: (on) => {
            colorsOn.current = on;
            if (on) applyLaneColors(); else clearLaneColors();
        },
        setNumbering: (on) => {
            numberingOn.current = on;
            if (on) renumberNow(); else stripNumbers();
        },
        setRiskBadges: (on) => {
            badgesOn.current = on;
            if (on) applyRiskBadges(); else clearRiskBadges();
        },
        getSvg: async () => (await modelerRef.current.saveSVG()).svg,
        getRcoMarks: () => {
            const out: { x: number; y: number; w: number; h: number; nRisk: number; nCtrl: number; nOpp: number }[] = [];
            const er = modelerRef.current?.get("elementRegistry");
            if (!er) return out;
            for (const el of er.getAll()) {
                if (!el.businessObject || el.waypoints || el.type === "label") continue;
                const flu = readFlu(el);
                if (!flu) continue;
                out.push({ x: el.x, y: el.y, w: el.width, h: el.height, nRisk: flu.risks.length, nCtrl: flu.controls.length, nOpp: flu.opportunities.length });
            }
            return out;
        },
        exportPdf: async (fileName = "diagrama.pdf") => {
            const { svg } = await modelerRef.current.saveSVG();
            const holder = document.createElement("div");
            holder.style.cssText = "position:fixed;left:-99999px;top:0";
            holder.innerHTML = svg;
            document.body.appendChild(holder);
            try {
                const svgEl = holder.querySelector("svg") as SVGSVGElement;
                let w = parseFloat(svgEl.getAttribute("width") || "");
                let h = parseFloat(svgEl.getAttribute("height") || "");
                if (!w || !h) {
                    const vb = (svgEl.getAttribute("viewBox") || "").split(/\s+/).map(Number);
                    w = vb[2] || 1000; h = vb[3] || 700;
                }
                const doc = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "pt", format: "a4", compress: true });
                const pw = doc.internal.pageSize.getWidth();
                const ph = doc.internal.pageSize.getHeight();
                const margin = 24;
                const scale = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h);
                await (doc as any).svg(svgEl, { x: margin, y: margin, width: w * scale, height: h * scale });
                doc.save(fileName);
            } finally {
                holder.remove();
            }
        },
    }));

    return <div ref={containerRef} className={`flu-bpmn-canvas ${className ?? ""}`} />;
});

BpmnEditor.displayName = "BpmnEditor";
