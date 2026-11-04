/**
 * Hace que el context-pad de una CONEXIÓN aparezca sobre el segmento visible
 * (el más cercano al centro del viewport), no en su último waypoint.
 * Portado de Diagramador/stage2-bpmn/src/web/context-pad-visible.js.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const MARGIN = 12;

function closestOnPolyline(wps: any[], cx: number, cy: number): { x: number; y: number } {
    let best = wps[0];
    let bestD = Infinity;
    for (let i = 1; i < wps.length; i++) {
        const a = wps[i - 1];
        const b = wps[i];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((cx - a.x) * dx + (cy - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + dx * t;
        const py = a.y + dy * t;
        const d = (px - cx) * (px - cx) + (py - cy) * (py - cy);
        if (d < bestD) { bestD = d; best = { x: px, y: py }; }
    }
    return best;
}

function ContextPadVisible(this: any, contextPad: any, canvas: any) {
    const orig = contextPad._getPosition.bind(contextPad);
    contextPad._getPosition = (target: any) => {
        const wps = !Array.isArray(target) && target && target.waypoints;
        if (wps && wps.length) {
            const vb = canvas.viewbox();
            const cx = vb.x + vb.width / 2;
            const cy = vb.y + vb.height / 2;
            const p = closestOnPolyline(wps, cx, cy);
            return {
                left: p.x * vb.scale - vb.x * vb.scale + MARGIN * canvas.zoom(),
                top: p.y * vb.scale - vb.y * vb.scale,
            };
        }
        return orig(target);
    };
}
(ContextPadVisible as any).$inject = ["contextPad", "canvas"];

export default { __init__: ["contextPadVisible"], contextPadVisible: ["type", ContextPadVisible] };
