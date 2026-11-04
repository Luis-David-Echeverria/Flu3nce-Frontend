import { Link } from "react-router";
import { plans } from "./data";
import { PlanCheckIcon } from "./icons";

export const PlanesSection = () => (
    <section className="section-plans" id="planes">
        <div className="plans-header">
            <h2 className="plans-headline">
                Elige tu plan.
                <br />
                <span className="accent">Empieza hoy.</span>
            </h2>
            <p className="plans-subhead">
                Sin contratos anuales obligatorios. Cancela cuando quieras. Todos los planes incluyen acceso completo al framework F-L-U-3-N-C-E.
            </p>
        </div>
        <div className="plans-grid">
            {plans.map((plan) => (
                <div className={`plan-card${plan.featured ? " plan-card-featured" : ""}`} key={plan.tier}>
                    {plan.featured && <div className="plan-badge">Más popular</div>}
                    <div className="plan-tier">{plan.tier}</div>
                    <div className="plan-price-row">
                        <span className={`plan-price${plan.priceCustom ? " plan-price-custom" : ""}`}>{plan.price}</span>
                        {plan.period && <span className="plan-period">{plan.period}</span>}
                    </div>
                    <div className="plan-profile">{plan.profile}</div>
                    <div className="plan-divider" />
                    <ul className="plan-features">
                        {plan.features.map((feature) => (
                            <li key={feature}>
                                {plan.featured ? <PlanCheckIcon circleFill="#ffffff" tickStroke="#1a3e7f" /> : <PlanCheckIcon />}
                                {feature}
                            </li>
                        ))}
                    </ul>
                    {plan.ctaHref.startsWith("#") || plan.ctaHref.startsWith("mailto:") ? (
                        <a href={plan.ctaHref} className={`plan-cta ${plan.featured ? "plan-cta-primary" : "plan-cta-secondary"}`}>
                            {plan.ctaLabel}
                        </a>
                    ) : (
                        <Link to={plan.ctaHref} className={`plan-cta ${plan.featured ? "plan-cta-primary" : "plan-cta-secondary"}`}>
                            {plan.ctaLabel}
                        </Link>
                    )}
                </div>
            ))}
        </div>
    </section>
);
