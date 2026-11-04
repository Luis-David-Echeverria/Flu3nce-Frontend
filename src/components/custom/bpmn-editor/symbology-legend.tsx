/**
 * Panel de simbología (modal centrado). Muestra TODA la simbología disponible:
 * formas, conectores y la capa de análisis de Fluence. Es presentación (overlay),
 * no toca el modelo BPMN. Los íconos de forma son la fuente bpmn-font (coinciden
 * 1:1 con el lienzo); los conectores se dibujan como mini-SVG. Cierra al hacer
 * clic fuera (sin cruz de esquina).
 */

const SHAPES: { icon: string; label: string }[] = [
    { icon: "bpmn-icon-start-event-none", label: "Inicio" },
    { icon: "bpmn-icon-end-event-none", label: "Fin" },
    { icon: "bpmn-icon-task", label: "Tarea" },
    { icon: "bpmn-icon-user-task", label: "Tarea de usuario (persona)" },
    { icon: "bpmn-icon-service-task", label: "Tarea de sistema" },
    { icon: "bpmn-icon-gateway-xor", label: "Decisión (exclusiva)" },
    { icon: "bpmn-icon-gateway-parallel", label: "Paralela (simultáneo)" },
    { icon: "bpmn-icon-data-store", label: "Base de datos / sistema" },
];

const RCO: { glyph: string; cls: string; label: string }[] = [
    { glyph: "▲", cls: "flu-risk", label: "Riesgo" },
    { glyph: "◆", cls: "flu-ctrl", label: "Control" },
    { glyph: "●", cls: "flu-opp", label: "Oportunidad" },
];

const LANE_COLORS = [
    { fill: "#E3F2FD", stroke: "#1565C0" },
    { fill: "#E8F5E9", stroke: "#2E7D32" },
    { fill: "#FFF3E0", stroke: "#E65100" },
];

function SeqArrow() {
    return (
        <svg width="42" height="14" viewBox="0 0 42 14" aria-hidden>
            <line x1="1" y1="7" x2="31" y2="7" stroke="#334155" strokeWidth="1.5" />
            <path d="M31 3 L40 7 L31 11 Z" fill="#334155" />
        </svg>
    );
}
function DataArrow() {
    return (
        <svg width="42" height="14" viewBox="0 0 42 14" aria-hidden>
            <line x1="1" y1="7" x2="32" y2="7" stroke="#334155" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M32 3 L40 7 L32 11" fill="none" stroke="#334155" strokeWidth="1.5" />
        </svg>
    );
}

export function SymbologyLegend({ onClose }: { onClose: () => void }) {
    return (
        <div className="flu-legend-backdrop" onClick={onClose}>
            <div className="flu-legend" role="dialog" aria-label="Simbología" onClick={(e) => e.stopPropagation()}>
                <div className="flu-legend-head">Simbología</div>

                <div className="flu-legend-cols">
                    <div>
                        <div className="flu-legend-section">Formas</div>
                        {SHAPES.map((s) => (
                            <div key={s.icon} className="flu-legend-row">
                                <span className={`flu-legend-icon ${s.icon}`} aria-hidden />
                                <span className="flu-legend-label">{s.label}</span>
                            </div>
                        ))}
                    </div>

                    <div>
                        <div className="flu-legend-section">Conectores</div>
                        <div className="flu-legend-row"><span className="flu-legend-conn"><SeqArrow /></span><span className="flu-legend-label">Flujo de secuencia</span></div>
                        <div className="flu-legend-row"><span className="flu-legend-conn"><DataArrow /></span><span className="flu-legend-label">Uso de sistema (lee / escribe)</span></div>
                        <div className="flu-legend-row"><span className={`flu-legend-icon bpmn-icon-intermediate-event-throw-link`} aria-hidden /><span className="flu-legend-label">Conector fuera de página (A)</span></div>

                        <div className="flu-legend-section">Análisis (Fluence)</div>
                        {RCO.map((s) => (
                            <div key={s.cls} className="flu-legend-row">
                                <span className={`flu-chip ${s.cls} flu-legend-chip`}>{s.glyph}</span>
                                <span className="flu-legend-label">{s.label}</span>
                            </div>
                        ))}

                        <div className="flu-legend-section">Carriles</div>
                        <div className="flu-legend-row">
                            <span className="flu-legend-swatches" aria-hidden>
                                {LANE_COLORS.map((c, i) => <i key={i} style={{ background: c.fill, borderColor: c.stroke }} />)}
                            </span>
                            <span className="flu-legend-label">Color por carril (rol)</span>
                        </div>
                    </div>
                </div>

                <div className="flu-legend-foot">Clic fuera para cerrar</div>
            </div>
        </div>
    );
}
