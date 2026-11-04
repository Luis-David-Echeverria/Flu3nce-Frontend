import { useState } from "react";
import { frameworkLayers, frameworkPhases } from "./data";
import { FlowArrowIcon } from "./icons";

export const FrameworkSection = () => {
    const [active, setActive] = useState(0);
    const phase = frameworkPhases[active];

    return (
        <section className="section-framework" id="como-funciona">
            <div className="fw-header">
                <h2 className="fw-headline">
                    Construido sobre <span className="accent">F-L-U-3-N-C-E.</span>
                </h2>
                <p className="fw-subhead">
                    Cada herramienta opera sobre el mismo modelo metodológico. No son módulos aislados — es un sistema de 7 fases que convierte cualquier proceso
                    en conocimiento accionable.
                </p>
            </div>
            <div className="fw-stepper">
                <div className="fw-nav">
                    {frameworkPhases.map((p, i) => (
                        <button key={p.label} type="button" className={`fw-nav-item${i === active ? " active" : ""}`} onClick={() => setActive(i)}>
                            <div className={`fw-nav-dot${p.isPivot ? " fw-nav-dot-3" : ""}`}>{p.dot}</div>
                            <div className="fw-nav-label">{p.label}</div>
                        </button>
                    ))}
                </div>
                <div className="fw-detail">
                    <div className="fw-panel active" key={phase.label}>
                        <div className="fw-panel-tag">{phase.tag}</div>
                        <div className="fw-panel-title">{phase.title}</div>
                        <p className="fw-panel-desc">{phase.desc}</p>
                        {phase.transformFlow && (
                            <div className="fw-transform-flow">
                                <span className="fw-tstate">As-Is</span>
                                <FlowArrowIcon />
                                <span className="fw-tstate">To-Be</span>
                                <FlowArrowIcon />
                                <span className="fw-tstate fw-tstate-ai">AI-Enabled</span>
                            </div>
                        )}
                        <div className="fw-panel-outputs">
                            <div className="fw-output-label">Outputs</div>
                            <div className="fw-output-pills">
                                {phase.outputs.map((output) => (
                                    <span className="fw-pill" key={output}>
                                        {output}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div className="fw-layers">
                {frameworkLayers.map((layer) => (
                    <div className={`fw-layer${layer.mid ? " fw-layer-mid" : ""}`} key={layer.num}>
                        <div className="fw-layer-num">{layer.num}</div>
                        <div className="fw-layer-name">{layer.name}</div>
                        <div className="fw-layer-sub">{layer.sub}</div>
                        <p className="fw-layer-desc">{layer.desc}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};
