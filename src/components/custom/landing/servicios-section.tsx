import { serviceInputs, services } from "./data";

export const ServiciosSection = () => (
    <section className="section-services" id="servicios">
        <div className="svc-header">
            <h2 className="svc-headline">
                8 herramientas. <span className="accent">Un solo flujo de trabajo.</span>
            </h2>
            <p className="svc-subhead">
                Cada herramienta está diseñada para el trabajo real de consultoría. Acepta texto, audio, video o documentos — y entrega resultados listos para el
                cliente.
            </p>
        </div>
        <div className="svc-grid">
            {services.map((svc) => (
                <div className="svc-card" key={svc.num}>
                    <div className="svc-icon">{svc.icon}</div>
                    <div className="svc-num">{svc.num}</div>
                    <div className="svc-name">{svc.name}</div>
                    <p className="svc-desc">{svc.desc}</p>
                    <div className="svc-outputs">
                        {svc.tags.map((tag) => (
                            <span className="svc-tag" key={tag}>
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            ))}
        </div>
        <div className="svc-inputs-strip">
            <div className="svc-inputs-label">Todos los servicios aceptan</div>
            <div className="svc-inputs-list">
                {serviceInputs.map((input) => (
                    <div className="svc-input-item" key={input.label}>
                        {input.icon}
                        {input.label}
                    </div>
                ))}
            </div>
        </div>
    </section>
);
