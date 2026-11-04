/**
 * Traducción ES para bpmn-js (reemplaza el servicio `translate`).
 * Portado de Diagramador/stage2-bpmn/src/web/translate-es.js a módulo ES.
 */
const ES: Record<string, string> = {
    // Paleta
    "Activate the hand tool": "Herramienta de mano (mover lienzo)",
    "Activate the lasso tool": "Herramienta de selección (lazo)",
    "Activate the create/remove space tool": "Crear/quitar espacio",
    "Activate the global connect tool": "Herramienta de conexión global",
    "Create StartEvent": "Crear evento de inicio",
    "Create start event": "Crear evento de inicio",
    "Create EndEvent": "Crear evento de fin",
    "Create Task": "Crear tarea",
    "Create task": "Crear tarea",
    "Create Gateway": "Crear compuerta",
    "Create gateway": "Crear compuerta",
    "Create expanded SubProcess": "Crear subproceso",
    "Create DataObjectReference": "Crear objeto de datos",
    "Create DataStoreReference": "Crear almacén de datos",
    "Create Group": "Crear grupo",
    "Create intermediate/boundary event": "Crear evento intermedio",
    "Create pool/participant": "Crear pool/participante",
    // Context-pad
    "Remove": "Eliminar",
    "Delete": "Eliminar",
    "Append Task": "Agregar tarea",
    "Append task": "Agregar tarea",
    "Append EndEvent": "Agregar evento de fin",
    "Append end event": "Agregar evento de fin",
    "Append Gateway": "Agregar compuerta",
    "Append gateway": "Agregar compuerta",
    "Append intermediate/boundary event": "Agregar evento intermedio",
    "Change type": "Cambiar tipo",
    "Change element": "Cambiar elemento",
    "Connect using Sequence/MessageFlow or Association": "Conectar (flujo o asociación)",
    "Connect using Association": "Conectar (asociación)",
    "Connect using DataInputAssociation": "Conectar (entrada de datos)",
    "Add Lane above": "Agregar carril arriba",
    "Divide into two Lanes": "Dividir en dos carriles",
    "Divide into three Lanes": "Dividir en tres carriles",
    "Add Lane below": "Agregar carril abajo",
    "Add text annotation": "Agregar anotación",
    // Tipos / reemplazo
    "Start Event": "Evento de inicio",
    "End Event": "Evento de fin",
    "Task": "Tarea",
    "User Task": "Tarea de usuario",
    "Service Task": "Tarea de servicio",
    "Exclusive Gateway": "Compuerta exclusiva",
    "Parallel Gateway": "Compuerta paralela",
    "Sub Process": "Subproceso",
    "Sub Process (collapsed)": "Subproceso (colapsado)",
    "Sub Process (expanded)": "Subproceso (expandido)",
};

function translateES(template: string, replacements?: Record<string, unknown>): string {
    const text = ES[template] || template;
    const r = replacements || {};
    return text.replace(/{([^}]+)}/g, (_, key: string) => (r[key] != null ? String(r[key]) : "{" + key + "}"));
}

export default { translate: ["value", translateES] };
