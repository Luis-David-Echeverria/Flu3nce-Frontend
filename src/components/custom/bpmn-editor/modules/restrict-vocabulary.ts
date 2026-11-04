/**
 * Cierra el vocabulario del editor al Contrato A: solo se pueden CREAR los 7
 * tipos soportados (startEvent, endEvent, task, userTask, serviceTask,
 * exclusiveGateway, parallelGateway). Filtra las tres superficies por las que
 * bpmn-js dejaría meter tipos exóticos:
 *   - la paleta (crear)
 *   - el menú de reemplazo bpmn-replace (cambiar de tipo)  ← el vector real
 *   - los "append" del context-pad (encadenar)
 *
 * Cada provider se registra con prioridad < 1000 (default) para correr DESPUÉS
 * del provider nativo y filtrar los entries ya acumulados (patrón "updater").
 * Se irá ampliando conforme crezca el contrato.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const LOW_PRIORITY = 500;

// Paleta: tools + separador + los 4 "create" permitidos + nuestra ⓘ.
// (parallelGateway se obtiene creando un exclusiveGateway y cambiándolo por replace.)
const PALETTE_KEEP = new Set([
    "hand-tool", "lasso-tool", "space-tool", "global-connect-tool", "tool-separator",
    "create.start-event", "create.end-event", "create.task", "create.exclusive-gateway",
    "create.data-store", // el tambor (base de datos / sistema)
    "flu-numbering", "flu-colors", "flu-badges", "flu-matrix",
]);

// Context-pad: solo estos "append.*" sobreviven (el resto de appends se quita;
// las entradas que no son append — borrar, conectar, replace, color, ref — se dejan).
const PAD_KEEP_APPEND = new Set(["append.append-task", "append.gateway", "append.end-event"]);

// Menú de reemplazo: solo cambios de tipo dentro del vocabulario.
const REPLACE_KEEP = new Set([
    "replace-with-none-start", "replace-with-none-end",
    "replace-with-task", "replace-with-user-task", "replace-with-service-task",
    "replace-with-exclusive-gateway", "replace-with-parallel-gateway",
]);

function RestrictVocabulary(this: any, palette: any, contextPad: any, popupMenu: any) {
    palette.registerProvider(LOW_PRIORITY, this);
    contextPad.registerProvider(LOW_PRIORITY, this);
    popupMenu.registerProvider("bpmn-replace", LOW_PRIORITY, this);
}
(RestrictVocabulary as any).$inject = ["palette", "contextPad", "popupMenu"];

(RestrictVocabulary as any).prototype.getPaletteEntries = function () {
    return (entries: Record<string, any>) => {
        for (const key of Object.keys(entries)) if (!PALETTE_KEEP.has(key)) delete entries[key];
        return entries;
    };
};

(RestrictVocabulary as any).prototype.getContextPadEntries = function () {
    return (entries: Record<string, any>) => {
        for (const key of Object.keys(entries)) {
            if (key.startsWith("append.") && !PAD_KEEP_APPEND.has(key)) delete entries[key];
        }
        return entries;
    };
};

(RestrictVocabulary as any).prototype.getPopupMenuEntries = function () {
    return (entries: Record<string, any>) => {
        for (const key of Object.keys(entries)) if (!REPLACE_KEEP.has(key)) delete entries[key];
        return entries;
    };
};

export default { __init__: ["fluRestrictVocabulary"], fluRestrictVocabulary: ["type", RestrictVocabulary] };
