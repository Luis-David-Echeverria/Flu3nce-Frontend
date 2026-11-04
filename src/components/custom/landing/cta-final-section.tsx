import { Link } from "react-router";
import { handleAnchorClick } from "./utils";

export const CtaFinalSection = () => (
    <section className="section-cta-final">
        <div className="cta-final-inner">
            <div className="cta-final-badge">Sin tarjeta de crédito</div>
            <h2 className="cta-final-headline">
                Tu próximo proyecto
                <br />
                entrega el doble.
            </h2>
            <p className="cta-final-sub">
                Prueba Flu3nce gratis. En menos de 5 minutos tienes tu primera herramienta trabajando en tu proyecto real.
            </p>
            <div className="cta-final-actions">
                <Link to="/login" className="cta-final-btn-primary">
                    Prueba gratis
                </Link>
                <a href="#planes" className="cta-final-btn-secondary" onClick={handleAnchorClick}>
                    Ver planes
                </a>
            </div>
        </div>
    </section>
);
