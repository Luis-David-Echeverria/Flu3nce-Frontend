/**
 * Context-pad: convertir una LÍNEA → par de refs (A), o un REF → línea.
 * Delega en window.fluenceToggleRef (lo implementa el editor: recalcula vía worker).
 * Portado de Diagramador/stage2-bpmn/src/web/ref-toggle-context-pad.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function refEdgeId(id: string): string | null {
    const m = /^(?:RefOut|RefIn)_(.+)$/.exec(id) || /^Flow_(?:toRef|fromRef)_(.+)$/.exec(id);
    return m ? m[1] : null;
}

function RefTogglePad(this: any, contextPad: any) {
    contextPad.registerProvider(this);
}
(RefTogglePad as any).$inject = ["contextPad"];

(RefTogglePad as any).prototype.getContextPadEntries = function (element: any) {
    const id = element.id || "";
    const bo = element.businessObject;
    const entries: Record<string, unknown> = {};
    const partOfRef = refEdgeId(id);
    const toggle = (edgeId: string, toRef: boolean) => {
        const fn = (window as any).fluenceToggleRef;
        if (fn) fn(edgeId, toRef);
    };

    if (partOfRef) {
        entries["ref-to-line"] = {
            group: "edit",
            title: "Convertir a línea",
            html: '<div class="entry ref-toggle" title="Convertir a línea" style="font-size:15px;font-weight:700">—▸</div>',
            action: { click: () => toggle(partOfRef, false) },
        };
    } else if (element.waypoints && bo && bo.$type === "bpmn:SequenceFlow") {
        entries["line-to-ref"] = {
            group: "edit",
            title: "Convertir a ref (A)",
            html: '<div class="entry ref-toggle" title="Convertir a ref" style="font-size:12px;font-weight:700">(A)</div>',
            action: { click: () => toggle(id, true) },
        };
    }
    return entries;
};

export default { __init__: ["refTogglePad"], refTogglePad: ["type", RefTogglePad] };
