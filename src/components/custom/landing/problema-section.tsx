import { painPoints } from "./data";

export const ProblemaSection = () => (
    <section className="section-problema">
        <h2 className="section-headline">
            ¿Te suena <span className="accent">familiar?</span>
        </h2>
        <p className="section-subhead">El trabajo de consultoría es valioso. El tiempo que se va en documentar, estructurar y presentar, no.</p>
        <div className="pain-grid pain-grid-3">
            {painPoints.map((pain) => (
                <div className="pain-card" key={pain.title}>
                    <div className="pain-icon">{pain.icon}</div>
                    <div className="pain-title">{pain.title}</div>
                    <p className="pain-desc">{pain.desc}</p>
                </div>
            ))}
        </div>
    </section>
);
