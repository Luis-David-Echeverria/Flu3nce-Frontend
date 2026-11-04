/**
 * Botones de color en el context-pad. Al hacer clic pinta con modeling.setColor
 * (escribe el color EN el BPMN → se guarda/exporta). Portado de
 * Diagramador/stage2-bpmn/src/web/color-context-pad.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const SWATCHES: { name: string; fill?: string; stroke?: string }[] = [
    { name: "Azul", fill: "#E3F2FD", stroke: "#1565C0" },
    { name: "Verde", fill: "#E8F5E9", stroke: "#2E7D32" },
    { name: "Naranja", fill: "#FFF3E0", stroke: "#E65100" },
    { name: "Rojo", fill: "#FFEBEE", stroke: "#C62828" },
    { name: "Violeta", fill: "#F3E5F5", stroke: "#6A1B9A" },
    { name: "Amarillo", fill: "#FFF9C4", stroke: "#F9A825" },
    { name: "Sin color", fill: undefined, stroke: undefined },
];

function isColorable(element: any): boolean {
    return !!(element && element.businessObject &&
        /bpmn:(Task|UserTask|ServiceTask|ScriptTask|ManualTask|Event|StartEvent|EndEvent|IntermediateThrowEvent|IntermediateCatchEvent|Gateway|ExclusiveGateway|ParallelGateway|SubProcess|DataStoreReference|DataObjectReference)/.test(element.type));
}

function ColorContextPadProvider(this: any, contextPad: any, modeling: any, selection: any) {
    this._modeling = modeling;
    this._selection = selection;
    contextPad.registerProvider(this);
}
(ColorContextPadProvider as any).$inject = ["contextPad", "modeling", "selection"];

(ColorContextPadProvider as any).prototype.getContextPadEntries = function (element: any) {
    const modeling = this._modeling;
    const selection = this._selection;
    if (!isColorable(element)) return {};

    const entries: Record<string, unknown> = {};
    SWATCHES.forEach((sw, i) => {
        entries["color-" + i] = {
            group: "color",
            title: "Color: " + sw.name,
            html:
                '<div class="entry color-swatch" title="' + sw.name + '" style="' +
                (sw.fill
                    ? "background:" + sw.fill + ";border:2px solid " + sw.stroke + ";"
                    : "background:#fff;border:2px dashed #999;position:relative;") +
                '">' + (sw.fill ? "" : '<span style="position:absolute;inset:0;color:#999;font-size:11px;text-align:center;line-height:18px">∅</span>') +
                "</div>",
            action: {
                click: () => {
                    const sel = selection.get();
                    const targets = sel && sel.length ? sel : [element];
                    modeling.setColor(targets, { fill: sw.fill, stroke: sw.stroke });
                },
            },
        };
    });
    return entries;
};

export default { __init__: ["colorContextPadProvider"], colorContextPadProvider: ["type", ColorContextPadProvider] };
