import type { ChatMovePreview } from "@/services/v2/chats";
import type { V2Project } from "@/services/v2/projects";
import { itemCount } from "./flu-chats-helpers";

type MoveProps = {
    projects: V2Project[];
    hasMoreProjects: boolean;
    onLoadMoreProjects: () => void;
    projectId: string;
    onProjectChange: (projectId: string) => void;
    preview: ChatMovePreview | null;
    busy: boolean;
    onClose: () => void;
    onCancel: () => void;
    onPreview: () => void;
    onConfirm: () => void;
};

/** Mover un chat sin proyecto a uno de los proyectos donde se puede escribir. */
export function FluMoveChatDialog({ projects, hasMoreProjects, onLoadMoreProjects, projectId, onProjectChange, preview, busy, onClose, onCancel, onPreview, onConfirm }: MoveProps) {
    return <div className="flu-move-backdrop"><section role="dialog" aria-modal="true" aria-label="Mover chat a proyecto" className="flu-move-dialog">
        <div className="flu-move-head"><div><p>MOVER CHAT</p><h2>Elige un proyecto</h2></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></div>
        <p>El chat seguirá siendo privado. Sus archivos y entregables viajarán con él.</p>
        <select aria-label="Proyecto destino" value={projectId} onChange={(event) => onProjectChange(event.target.value)}><option value="">Elige proyecto</option>{projects.filter((item) => item.rol !== "lector").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        {hasMoreProjects ? <button type="button" disabled={busy} onClick={onLoadMoreProjects} className="flu-directory-more">Cargar más proyectos</button> : null}
        {preview ? <div className="flu-move-summary" role="status"><strong>Se moverán a {projects.find((project) => project.id === projectId)?.name ?? "este proyecto"}:</strong><span>{itemCount(preview.messageCount, "mensaje", "mensajes")} · {itemCount(preview.sources.length, "archivo", "archivos")} · {itemCount(preview.deliverables.length, "entregable", "entregables")} · {itemCount(preview.contributions.length, "aporte", "aportes")}</span><small>El chat y sus versiones se mantienen; solo cambia el proyecto al que pertenecen.</small></div> : null}
        <div className="flu-move-actions"><button type="button" onClick={onCancel}>Cancelar</button>{preview ? <button type="button" disabled={busy} onClick={onConfirm}>Confirmar movimiento</button> : <button type="button" disabled={busy || !projectId} onClick={onPreview}>Continuar</button>}</div>
    </section></div>;
}

type CreateProps = {
    name: string;
    onNameChange: (value: string) => void;
    description: string;
    onDescriptionChange: (value: string) => void;
    error: string | null;
    busy: boolean;
    onClose: () => void;
    onSubmit: () => void;
};

/** Crear un proyecto desde la barra lateral o el directorio. */
export function FluCreateProjectDialog({ name, onNameChange, description, onDescriptionChange, error, busy, onClose, onSubmit }: CreateProps) {
    return <div className="flu-move-backdrop"><section role="dialog" aria-modal="true" aria-label="Crear proyecto" className="flu-move-dialog flu-project-create-dialog" onKeyDown={(event) => { if (event.key === "Escape" && !busy) { event.preventDefault(); onClose(); } }}>
        <div className="flu-move-head"><div><p>NUEVO PROYECTO</p><h2>Crear proyecto</h2></div><button type="button" onClick={onClose} disabled={busy} aria-label="Cerrar">×</button></div>
        <p>Reúne chats relacionados sin compartir automáticamente los archivos de cada conversación.</p>
        <form onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
            <label htmlFor="flu-project-name">Nombre del proyecto</label>
            <input id="flu-project-name" autoFocus required maxLength={120} value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Ej. Compras menores" />
            <label htmlFor="flu-project-description">Descripción <span>(opcional)</span></label>
            <textarea id="flu-project-description" value={description} onChange={(event) => onDescriptionChange(event.target.value)} rows={3} placeholder="¿Qué trabajo reunirás aquí?" />
            {error ? <p role="alert" className="flu-project-create-error">{error}</p> : null}
            <div className="flu-move-actions"><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button type="submit" disabled={busy || !name.trim()}>{busy ? "Creando…" : "Crear proyecto"}</button></div>
        </form>
    </section></div>;
}
