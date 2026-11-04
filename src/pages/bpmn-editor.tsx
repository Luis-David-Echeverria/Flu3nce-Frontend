import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { TopBar } from "@/components/custom/top-bar";
import { usePageTitle } from "@/hooks/use-page-title";
import { BpmnEditor, type BpmnEditorHandle } from "@/components/custom/bpmn-editor/bpmn-editor";
import { SymbologyLegend } from "@/components/custom/bpmn-editor/symbology-legend";
import { exportDiagramPdf } from "@/components/custom/bpmn-editor/pdf-export";
import type { ProcessNode, RcoItem } from "@/components/custom/bpmn-editor/pipeline/contracts/contract-a";
import { getProject } from "@/services/v2/projects";
import { DeliverableConflictError, getDeliverable, getDeliverableJson, getDeliverableVersionJson, listDeliverableVersions, saveDeliverableContent } from "@/services/v2/deliverables";

// Lienzo vacío inicial (placeholder mientras se genera/carga; queda así si el
// proyecto no tiene diagrama). El demo standalone se genera al abrir desde el
// Contrato A de ejemplo, así siempre está fresco (con tambores, etc.).
const EMPTY_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" id="Definitions_empty" targetNamespace="http://fluence.mx/bpmn">
  <bpmn:process id="Process_empty" isExecutable="false" />
  <bpmndi:BPMNDiagram id="Diagram_empty"><bpmndi:BPMNPlane id="Plane_empty" bpmnElement="Process_empty" /></bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const optRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer" };

// Editor BPMN embebido con el pipeline corriendo CLIENT-SIDE (Web Worker, sin Node).
export const BpmnEditorPage = () => {
    const [params, setParams] = useSearchParams();
    const { deliverableId: requestedDeliverableId } = useParams<{ deliverableId: string }>();
    const folder = params.get("project");
    const requestedVersionId = params.get("version");
    const chatId = params.get("chat");
    const backToChat = chatId ? `/flu?chat=${encodeURIComponent(chatId)}` : "/flu";
    const baseName = params.get("name") || "diagrama";
    const [procName, setProcName] = useState("");
    const [readOnly, setReadOnly] = useState(true);
    const loadSequence = useRef(0);
    usePageTitle(folder ? (procName || "Diagrama del proceso") : "Editor BPMN");
    const editorRef = useRef<BpmnEditorHandle>(null);
    const [deliverableId, setDeliverableId] = useState<string | null>(null);
    const [deliverableVersion, setDeliverableVersion] = useState<number | null>(null);
    const [loaded, setLoaded] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [jsonView, setJsonView] = useState<string | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const [expFormat, setExpFormat] = useState<"pdf" | "bpmn">("pdf");
    const [expSym, setExpSym] = useState(false);
    const [expRco, setExpRco] = useState(false);
    const [legend, setLegend] = useState(false);
    const [rco, setRco] = useState<ProcessNode[] | null>(null);
    const [rcoFocus, setRcoFocus] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{ message: string; onOk: () => void } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const exportName = procName || baseName || "diagrama";

    // Error visible = mensaje para el usuario; el detalle técnico solo a consola.
    const showError = (msg: string, err?: unknown) => { if (err) console.error("[bpmn-editor]", err); setErrorMsg(msg); };

    // Open only the deliverable/version requested from the chat. Navigation never generates.
    const loadDiagram = useCallback(async () => {
        const sequence = ++loadSequence.current;
        setLoaded(false); setReadOnly(true); setErrorMsg(null);
        if (!folder || !requestedDeliverableId) { setErrorMsg("Abre un diagrama desde su entregable en el chat."); return; }
        setBusy("Cargando el diagrama…");
        try {
            const [project, deliverable, versions] = await Promise.all([
                getProject(folder), getDeliverable(folder, requestedDeliverableId),
                listDeliverableVersions(folder, requestedDeliverableId),
            ]);
            if (deliverable.type !== "diagram_as_is") throw new Error("El entregable seleccionado no es un diagrama.");
            const data = requestedVersionId
                ? await getDeliverableVersionJson(folder, requestedDeliverableId, requestedVersionId)
                : await getDeliverableJson(folder, requestedDeliverableId);
            if (sequence !== loadSequence.current) return;
            await editorRef.current?.generate(data);
            if (sequence !== loadSequence.current) return;
            setProcName(deliverable.title || "Diagrama del proceso");
            setDeliverableId(deliverable.id); setDeliverableVersion(deliverable.currentVersion);
            setReadOnly(project.rol === "lector" || !!requestedVersionId && requestedVersionId !== versions.current);
            setLoaded(true); setDirty(false);
        } catch (error) { if (sequence === loadSequence.current) showError("No se pudo cargar esta versión del diagrama. Vuelve al chat para reintentar.", error); }
        finally { if (sequence === loadSequence.current) setBusy(null); }
    }, [folder, requestedDeliverableId, requestedVersionId]);

    const handleSave = async () => {
        if (!folder) { showError("Abre el editor desde un proyecto para guardar."); return; }
        if (!deliverableId) { showError("Este proyecto aún no tiene un diagrama para editar. Genéralo primero desde el proceso."); return; }
        setBusy("Guardando en el proyecto…");
        try {
            // El canónico del diagrama es el Contrato A (JSON). Se guarda con PUT /content
            // → nueva versión; If-Match contra la versión que cargamos (concurrencia).
            const contract = await editorRef.current!.getContract();
            const updated = await saveDeliverableContent(folder, deliverableId, contract, deliverableVersion ?? undefined);
            setDeliverableVersion(updated.currentVersion);
            if (requestedVersionId) setParams((current) => { current.delete("version"); return current; }, { replace: true });
            setDirty(false);
            setBusy(null);
        } catch (err) {
            setBusy(null);
            if (err instanceof DeliverableConflictError) {
                setConfirm({ message: err.message, onOk: () => void loadDiagram() });
            } else {
                showError("No se pudo guardar el diagrama.", err);
            }
        }
    };

    useEffect(() => {
        void loadDiagram();
        return () => { loadSequence.current++; };
    }, [loadDiagram]);

    const downloadBpmn = async () => {
        const xml = await editorRef.current?.getXml();
        if (!xml) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
        a.download = `${exportName}.bpmn`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };

    const handleExport = async () => {
        setExportOpen(false);
        setBusy("Exportando…");
        try {
            const contract = expRco ? await editorRef.current?.getContract() : undefined;
            if (expFormat === "pdf") {
                const svg = await editorRef.current?.getSvg();
                // Los badges sobre el diagrama solo si se pidió el anexo RCO.
                const marks = expRco ? editorRef.current?.getRcoMarks() : undefined;
                await exportDiagramPdf({ svg, marks, contract, symbology: expSym, rco: expRco, fileName: `${exportName}.pdf` });
            } else {
                await downloadBpmn();
                // Los anexos no caben en el .bpmn → PDF aparte con esas hojas.
                if (expSym || expRco) await exportDiagramPdf({ contract, symbology: expSym, rco: expRco, fileName: `${exportName}-anexos.pdf` });
            }
            setBusy(null);
        } catch (err) {
            setBusy(null);
            showError("No se pudo exportar el diagrama.", err);
        }
    };

    const showRco = async (focusId?: string) => {
        try {
            const contract = await editorRef.current?.getContract();
            const rows = (contract?.nodes ?? []).filter((n) => n.risks?.length || n.controls?.length || n.opportunities?.length);
            setRco(rows);
            setRcoFocus(focusId ?? null);
        } catch {
            setRco([]);
            setRcoFocus(null);
        }
    };

    const showJson = async () => {
        try {
            const contract = await editorRef.current?.getContract();
            setJsonView(JSON.stringify(contract, null, 2));
        } catch (err) {
            showError("No se pudo mostrar la estructura del diagrama.", err);
        }
    };

    // El ícono "matriz" de la paleta y el clic en un badge abren la Matriz RCO
    // (con foco en la actividad del badge, si viene).
    useEffect(() => {
        (window as unknown as { fluenceShowRco?: (id?: string) => void }).fluenceShowRco = (id?: string) => void showRco(id);
        return () => { delete (window as unknown as { fluenceShowRco?: (id?: string) => void }).fluenceShowRco; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Al abrir la matriz con foco, desplaza esa fila a la vista.
    useEffect(() => {
        if (rco && rcoFocus) document.getElementById(`rco-row-${rcoFocus}`)?.scrollIntoView({ block: "center" });
    }, [rco, rcoFocus]);

    return (
        <main className="flu-diagram-editor-page flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--fl-bg)", color: "var(--fl-text)", fontFamily: "var(--fl-font)" }}>
            <TopBar
                breadcrumbs={[{ label: "Volver al chat", href: backToChat }, { label: procName || "Editor BPMN" }]}
            />

            {/* Encabezado del editor: nombre del proceso + acciones (plano, alternativa C) */}
            <div className="flu-editor-toolbar" style={{ background: "var(--fl-bg)", borderBottom: "1px solid var(--fl-divider)", padding: "11px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <h1 style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em", color: "var(--fl-text)", margin: 0, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {folder ? (procName || "…") : "Diagrama del proceso (BPMN 2.0)"}
                    {dirty && <span title="Cambios sin guardar" style={{ color: "var(--fl-warning)", marginLeft: 6 }}>*</span>}
                </h1>
                <div className="flu-editor-toolbar-actions" style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}>
                    {folder && <ToolBtn dark onClick={() => setConfirm({ message: "Recargar descarta los cambios locales sin guardar y vuelve a abrir la versión seleccionada.", onOk: () => void loadDiagram() })}>Recargar</ToolBtn>}
                    <ToolBtn dark onClick={() => setConfirm({ message: "Auto-organizar re-acomoda todo el diagrama; podrías perder las posiciones que ajustaste a mano.", onOk: () => void editorRef.current?.autoLayout() })}>Auto-organizar</ToolBtn>
                    <ToolBtn dark onClick={showJson}>Ver JSON</ToolBtn>
                    {folder && !readOnly && loaded && <ToolBtn dark primary onClick={() => void handleSave()}>Guardar</ToolBtn>}
                    <div style={{ position: "relative" }}>
                        <ToolBtn dark primary onClick={() => setExportOpen((o) => !o)}>Exportar ▾</ToolBtn>
                        {exportOpen && (
                            <>
                                <div style={{ position: "fixed", inset: 0, zIndex: 19 }} onClick={() => setExportOpen(false)} />
                                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20, width: 244, background: "var(--fl-bg)", border: "1px solid var(--fl-border)", borderRadius: 16, boxShadow: "var(--fl-shadow-menu)", padding: 14, fontSize: 12, color: "#334155" }}>
                                    <div style={{ fontWeight: 700, color: "var(--fl-text-4)", fontSize: 9, letterSpacing: "0.1em", marginBottom: 6 }}>FORMATO</div>
                                    <label style={optRow}><input type="radio" checked={expFormat === "pdf"} onChange={() => setExpFormat("pdf")} /> PDF</label>
                                    <label style={optRow}><input type="radio" checked={expFormat === "bpmn"} onChange={() => setExpFormat("bpmn")} /> BPMN</label>
                                    <div style={{ borderTop: "1px solid var(--fl-divider)", margin: "10px 0", paddingTop: 8, fontWeight: 700, color: "var(--fl-text-4)", fontSize: 9, letterSpacing: "0.1em" }}>ANEXOS</div>
                                    <label style={optRow}><input type="checkbox" checked={expSym} onChange={(e) => setExpSym(e.target.checked)} /> Hoja de simbología</label>
                                    <label style={optRow}><input type="checkbox" checked={expRco} onChange={(e) => setExpRco(e.target.checked)} /> Hoja de RCO</label>
                                    {expFormat === "bpmn" && (expSym || expRco) && (
                                        <p style={{ margin: "8px 0 0", fontSize: 10.5, color: "var(--fl-text-4)", lineHeight: 1.4 }}>Los anexos se descargan como un PDF aparte.</p>
                                    )}
                                    <button type="button" onClick={() => void handleExport()} style={{ marginTop: 12, width: "100%", padding: "8px 0", background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Exportar</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {loaded && readOnly ? <p role="status" className="px-6 pt-2 text-xs text-[color:var(--fl-text-4)]">Vista de una versión histórica o con acceso de lectura. Los cambios locales no se guardarán.</p> : null}

            <div style={{ padding: 16, flex: 1, minHeight: 0 }}>
                <div style={{ position: "relative", height: "100%", border: "1px solid var(--fl-border)", borderRadius: 12, overflow: "hidden", background: "var(--fl-bg)" }}>
                    <BpmnEditor ref={editorRef} xml={EMPTY_BPMN} onChange={() => setDirty(true)} onBusy={setBusy} />
                    {/* Zoom flotante (esquina inferior derecha) */}
                    <div style={{ position: "absolute", right: 14, bottom: 14, zIndex: 8, display: "flex", flexDirection: "column", background: "var(--fl-bg)", border: "1px solid var(--fl-border)", borderRadius: 10, boxShadow: "0 4px 14px rgba(15,23,42,0.12)", overflow: "hidden" }}>
                        <ZoomBtn onClick={() => editorRef.current?.zoom(0.2)} title="Acercar">+</ZoomBtn>
                        <ZoomBtn onClick={() => editorRef.current?.fit()} title="Ajustar a la vista">⤢</ZoomBtn>
                        <ZoomBtn onClick={() => editorRef.current?.zoom(-0.2)} title="Alejar">−</ZoomBtn>
                    </div>
                    {/* Simbología flotante (esquina inferior izquierda) */}
                    <button
                        type="button"
                        onClick={() => setLegend(true)}
                        title="Simbología"
                        style={{ position: "absolute", left: 14, bottom: 14, zIndex: 8, width: 36, height: 36, borderRadius: "50%", background: "var(--fl-bg)", border: "1px solid var(--fl-border)", boxShadow: "0 4px 14px rgba(15,23,42,0.12)", color: "var(--fl-text)", fontStyle: "italic", fontWeight: 700, fontSize: 17, fontFamily: "Georgia, 'Times New Roman', serif", cursor: "pointer" }}
                    >
                        i
                    </button>
                    {legend && <SymbologyLegend onClose={() => setLegend(false)} />}
                    {rco !== null && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12, padding: 24 }} onClick={() => setRco(null)}>
                            <div style={{ background: "var(--fl-bg)", borderRadius: 14, width: "min(820px, 100%)", maxHeight: "100%", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--fl-border)" }}>
                                    <b style={{ fontSize: 14, color: "var(--fl-text)" }}>Matriz de riesgos, controles y oportunidades</b>
                                    <ToolBtn onClick={() => setRco(null)}>Cerrar</ToolBtn>
                                </div>
                                {rco.length === 0 ? (
                                    <p style={{ padding: 24, color: "var(--fl-text-4)", fontSize: 13, margin: 0 }}>Este diagrama no tiene riesgos, controles ni oportunidades registrados.</p>
                                ) : (
                                    <div style={{ overflow: "auto", padding: "8px 18px 18px" }}>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, tableLayout: "fixed" }}>
                                            <colgroup>
                                                <col style={{ width: "31%" }} /><col style={{ width: "23%" }} /><col style={{ width: "23%" }} /><col style={{ width: "23%" }} />
                                            </colgroup>
                                            <thead>
                                                <tr style={{ textAlign: "left", color: "var(--fl-text-4)" }}>
                                                    <th style={{ padding: "8px 8px", borderBottom: "2px solid var(--fl-border)" }}>Actividad</th>
                                                    <th style={{ padding: "8px 8px", borderBottom: "2px solid var(--fl-border)", color: "var(--fl-error-text)" }}>▲ Riesgos</th>
                                                    <th style={{ padding: "8px 8px", borderBottom: "2px solid var(--fl-border)", color: "#2563eb" }}>◆ Controles</th>
                                                    <th style={{ padding: "8px 8px", borderBottom: "2px solid var(--fl-border)", color: "#16a34a" }}>● Oportunidades</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rco.map((n) => {
                                                    const focused = rcoFocus === n.id;
                                                    const td = { padding: "10px 8px", borderBottom: "2px solid var(--fl-border)", background: focused ? "var(--fl-primary-subtle)" : undefined, wordBreak: "break-word", overflowWrap: "anywhere" } as React.CSSProperties;
                                                    return (
                                                        <tr
                                                            key={n.id}
                                                            id={`rco-row-${n.id}`}
                                                            title="Ir a la actividad en el diagrama"
                                                            style={{ verticalAlign: "top", cursor: "pointer" }}
                                                            onClick={() => { editorRef.current?.selectElement(n.id); setRco(null); }}
                                                            onMouseEnter={(e) => { if (!focused) e.currentTarget.style.background = "var(--fl-hover)"; }}
                                                            onMouseLeave={(e) => { if (!focused) e.currentTarget.style.background = ""; }}
                                                        >
                                                            <td style={{ ...td, fontWeight: 600, color: "var(--fl-text)" }}>{n.name}</td>
                                                            <td style={td}><RcoCell items={n.risks} color="#dc2626" /></td>
                                                            <td style={td}><RcoCell items={n.controls} color="#2563eb" /></td>
                                                            <td style={td}><RcoCell items={n.opportunities} color="#16a34a" /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {jsonView !== null && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 12, padding: 24 }} onClick={() => setJsonView(null)}>
                            <div style={{ background: "var(--fl-bg)", borderRadius: 12, width: "min(720px, 100%)", maxHeight: "100%", display: "flex", flexDirection: "column", boxShadow: "0 20px 50px rgba(0,0,0,.3)" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--fl-border)" }}>
                                    <b style={{ fontSize: 13, color: "var(--fl-text)" }}>Estructura del diagrama (JSON)</b>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <ToolBtn onClick={() => navigator.clipboard?.writeText(jsonView)}>Copiar</ToolBtn>
                                        <ToolBtn onClick={() => setJsonView(null)}>Cerrar</ToolBtn>
                                    </div>
                                </div>
                                <pre style={{ margin: 0, padding: 16, overflow: "auto", fontSize: 12, lineHeight: 1.5, fontFamily: "var(--fl-mono)", color: "var(--fl-text-2)" }}>{jsonView}</pre>
                            </div>
                        </div>
                    )}
                    {confirm && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 13, padding: 24 }} onClick={() => setConfirm(null)}>
                            <div style={{ background: "var(--fl-bg)", borderRadius: 14, width: "min(430px, 100%)", boxShadow: "0 20px 50px rgba(0,0,0,.3)", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", gap: 12, padding: "18px 20px 6px" }}>
                                    <div style={{ flex: "none", fontSize: 22, lineHeight: 1.1, color: "var(--fl-warning)" }}>⚠</div>
                                    <div>
                                        <b style={{ fontSize: 14, color: "var(--fl-text)" }}>Puedes perder ajustes manuales</b>
                                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--fl-text-3)", lineHeight: 1.45 }}>{confirm.message}</p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px 18px" }}>
                                    <ToolBtn onClick={() => setConfirm(null)}>Cancelar</ToolBtn>
                                    <ToolBtn primary onClick={() => { const ok = confirm.onOk; setConfirm(null); ok(); }}>Continuar</ToolBtn>
                                </div>
                            </div>
                        </div>
                    )}
                    {errorMsg && (
                        <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--fl-bg) 94%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 12, padding: 32 }}>
                            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--fl-error-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fl-error)", fontSize: 24, fontWeight: 700 }}>!</div>
                            <p style={{ fontSize: 13, color: "var(--fl-text-3)", maxWidth: 420, textAlign: "center", lineHeight: 1.5 }}>{errorMsg}</p>
                            <div style={{ display: "flex", gap: 10 }}>
                                <ToolBtn onClick={() => setErrorMsg(null)}>Cerrar</ToolBtn>
                                {folder && <ToolBtn primary onClick={() => { setErrorMsg(null); void loadDiagram(); }}>Reintentar</ToolBtn>}
                            </div>
                        </div>
                    )}
                    {busy && (
                        <div style={{ position: "absolute", inset: 0, background: "color-mix(in srgb, var(--fl-bg) 82%, transparent)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 10, animation: "fluFade .18s ease both" }}>
                            <div style={{ width: 40, height: 40 }}>
                                <svg viewBox="0 0 40 40" style={{ width: 40, height: 40, animation: "spin 1s linear infinite" }}>
                                    <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" style={{ color: "var(--fl-primary-subtle-2)" }} />
                                    <path d="M20 4 A16 16 0 0 1 36 20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" style={{ color: "var(--fl-primary)" }} />
                                </svg>
                            </div>
                            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--fl-text)", maxWidth: 360, textAlign: "center" }}>{busy}</p>
                            <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fluFade{from{opacity:0}to{opacity:1}}`}</style>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

function RcoCell({ items, color }: { items?: RcoItem[]; color: string }) {
    if (!items?.length) return <span style={{ color: "var(--fl-icon-muted)" }}>—</span>;
    return (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((it, i) => (
                <li key={i} style={{ color: "var(--fl-text-2)", lineHeight: 1.35, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                    {it.code && <b style={{ color, marginRight: 4 }}>{it.code}</b>}{it.text}
                </li>
            ))}
        </ul>
    );
}


function ZoomBtn({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            style={{
                width: 34, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                background: "var(--fl-bg)", color: "var(--fl-text)", border: "none", borderBottom: "1px solid var(--fl-divider)",
                fontSize: 16, cursor: "pointer", fontFamily: "inherit",
            }}
        >
            {children}
        </button>
    );
}

function ToolBtn({ children, onClick, primary, active, dark }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; active?: boolean; dark?: boolean }) {
    // El encabezado ya no es oscuro: `dark` se conserva por compatibilidad y se ve igual que el claro.
    void dark;
    const bg = primary ? "var(--fl-primary)" : active ? "var(--fl-primary-subtle)" : "var(--fl-bg)";
    const color = primary ? "#fff" : active ? "var(--fl-primary-text)" : "var(--fl-text-2)";
    const border = primary ? "none" : `1px solid ${active ? "var(--fl-primary-line)" : "var(--fl-border)"}`;
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 34, height: 34, padding: "0 12px",
                borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                background: bg, color, border,
                transition: "background .15s ease, border-color .15s ease, color .15s ease",
            }}
        >
            {children}
        </button>
    );
}
