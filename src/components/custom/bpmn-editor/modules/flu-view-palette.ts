/**
 * Entradas de VISTA en la paleta de bpmn-js: numerar, colorear por carril,
 * marcar RCO y abrir la matriz RCO. Cada una delega en un window.fluence*
 * (numerar/colorear/marcar las implementa el editor; la matriz, la página).
 *
 * Los íconos son de @untitledui/icons (misma librería que el resto de Fluence),
 * renderizados a SVG estático → línea consistente y moderna, con currentColor.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Hash02, Colors, AnnotationDots, Grid01 } from "@untitledui/icons";

type IconType = ComponentType<{ width?: number; height?: number }>;
const wrap = (Icon: IconType) =>
    `<div class="entry flu-view-entry">${renderToStaticMarkup(createElement(Icon, { width: 21, height: 21 }))}</div>`;

const HTML = {
    num: wrap(Hash02 as IconType),
    colors: wrap(Colors as IconType),
    rco: wrap(AnnotationDots as IconType),
    matrix: wrap(Grid01 as IconType),
};

function FluViewPalette(this: any, palette: any) {
    palette.registerProvider(this);
}
(FluViewPalette as any).$inject = ["palette"];

(FluViewPalette as any).prototype.getPaletteEntries = function () {
    const entry = (html: string, title: string, hook: string) => ({
        group: "flu-help",
        html,
        title,
        action: { click: () => (window as any)[hook]?.() },
    });
    return {
        "flu-numbering": entry(HTML.num, "Numerar actividades", "fluenceToggleNumbering"),
        "flu-colors": entry(HTML.colors, "Colorear por carril (rol)", "fluenceToggleColors"),
        "flu-badges": entry(HTML.rco, "Marcar riesgos / controles / oportunidades", "fluenceToggleBadges"),
        "flu-matrix": entry(HTML.matrix, "Matriz RCO (ver todos)", "fluenceShowRco"),
    };
};

export default { __init__: ["fluViewPalette"], fluViewPalette: ["type", FluViewPalette] };
