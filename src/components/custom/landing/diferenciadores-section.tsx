import { diffColumns, diffPillars, diffRows, type DiffValue } from "./data";

const cellClass: Record<DiffValue["kind"], string> = {
    yes: "diff-cell diff-cell-yes",
    no: "diff-cell diff-cell-no",
    "yes-muted": "diff-cell diff-cell-yes-muted",
};

export const DiferenciadoresSection = () => (
    <section className="section-diff" id="diferenciadores">
        <div className="diff-header">
            <h2 className="diff-headline">
                No es ChatGPT con un prompt.
                <br />
                <span className="accent">Es metodología embebida.</span>
            </h2>
            <p className="diff-subhead">
                Cualquier herramienta de AI puede generar texto. Flu3nce aplica el rigor de una consultoría Big 4 en cada output — con la velocidad de la
                inteligencia artificial.
            </p>
        </div>
        <div className="diff-table">
            <div className="diff-row diff-row-head">
                <div className="diff-cell diff-cell-feature" />
                {diffColumns.map((col) => (
                    <div className="diff-cell diff-cell-competitor" key={col}>
                        {col}
                    </div>
                ))}
                <div className="diff-cell diff-cell-flu3nce">
                    <span className="diff-flu3nce-label">Flu3nce</span>
                </div>
            </div>
            {diffRows.map((row) => (
                <div className="diff-row" key={row.feature}>
                    <div className="diff-cell diff-cell-feature">{row.feature}</div>
                    <div className={cellClass[row.traditional.kind]}>{row.traditional.text}</div>
                    <div className={cellClass[row.generic.kind]}>{row.generic.text}</div>
                    <div className={cellClass[row.flu3nce.kind]}>{row.flu3nce.text}</div>
                </div>
            ))}
        </div>
        <div className="diff-pillars">
            {diffPillars.map((pillar) => (
                <div className="diff-pillar" key={pillar.title}>
                    <div className="diff-pillar-icon">{pillar.icon}</div>
                    <div className="diff-pillar-title">{pillar.title}</div>
                    <p className="diff-pillar-desc">{pillar.desc}</p>
                </div>
            ))}
        </div>
    </section>
);
