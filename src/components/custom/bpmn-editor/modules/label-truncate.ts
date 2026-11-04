/**
 * Truncado SOLO visual de etiquetas (envuelve textRenderer.createText).
 * El modelo (businessObject.name) queda íntegro; el "…" vive solo en el SVG/PDF.
 * Portado de Diagramador/stage2-bpmn/src/web/label-truncate.js.
 */
const MAX = 50;

function truncate(text: unknown): unknown {
    if (typeof text !== "string" || text.length <= MAX) return text;
    const hard = text.slice(0, MAX);
    const atWord = hard.replace(/\s+\S*$/, "");
    const base = atWord.length >= Math.floor(MAX * 0.6) ? atWord : hard;
    return base.trimEnd() + "…";
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function LabelTruncate(this: any, textRenderer: any) {
    const original = textRenderer.createText.bind(textRenderer);
    textRenderer.createText = (text: unknown, options: unknown) => original(truncate(text), options);
}
(LabelTruncate as any).$inject = ["textRenderer"];

export default { __init__: ["labelTruncate"], labelTruncate: ["type", LabelTruncate] };
