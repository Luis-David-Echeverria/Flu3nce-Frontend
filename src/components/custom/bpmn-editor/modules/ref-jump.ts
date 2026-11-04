/**
 * Alt + click en una ref (A) → salta y centra su par (A).
 * Portado de Diagramador/stage2-bpmn/src/web/ref-jump.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
function pairIdOf(id: string): string | null {
    const clean = id.replace(/_label$/, "");
    const m = /^Ref(Out|In)_(.+)$/.exec(clean);
    if (!m) return null;
    return "Ref" + (m[1] === "Out" ? "In" : "Out") + "_" + m[2];
}

function RefJump(this: any, eventBus: any, elementRegistry: any, canvas: any) {
    eventBus.on("element.click", 1500, (e: any) => {
        const oe = e.originalEvent;
        if (!oe || !oe.altKey) return;
        const el = e.element;
        if (!el || !el.id) return;
        const pairId = pairIdOf(el.id);
        if (!pairId) return;
        const pair = elementRegistry.get(pairId);
        if (!pair) return;

        const goToPair = () => {
            try {
                canvas.scrollToElement(pair, { top: 160, right: 160, bottom: 160, left: 160 });
            } catch {
                const vb = canvas.viewbox();
                canvas.viewbox({
                    x: pair.x + pair.width / 2 - vb.width / 2,
                    y: pair.y + pair.height / 2 - vb.height / 2,
                    width: vb.width,
                    height: vb.height,
                });
            }
        };
        const animate = (window as any).fluenceAnimateViewbox;
        if (typeof animate === "function") animate(goToPair);
        else goToPair();

        try {
            canvas.addMarker(pairId, "ref-jump-flash");
            setTimeout(() => { try { canvas.removeMarker(pairId, "ref-jump-flash"); } catch { /* noop */ } }, 1200);
        } catch { /* noop */ }

        return false;
    });
}
(RefJump as any).$inject = ["eventBus", "elementRegistry", "canvas"];

export default { __init__: ["refJump"], refJump: ["type", RefJump] };
