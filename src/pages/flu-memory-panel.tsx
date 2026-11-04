import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ApiServiceError } from "@/services/v2/http";
import { forgetMemory, getMemorySettings, listMemories, setMemoryPaused, type Memory, type MemorySettings } from "@/services/v2/memories";

export function FluMemoryPanel({ onClose }: { onClose: () => void }) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [cursor, setCursor] = useState<string | undefined>();
    const [settings, setSettings] = useState<MemorySettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [confirmForget, setConfirmForget] = useState<string | null>(null);
    const panel = useRef<HTMLElement>(null);

    useEffect(() => {
        const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        panel.current?.querySelector<HTMLElement>("button")?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKeyDown);
        return () => { document.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
    }, [onClose]);

    useEffect(() => {
        let active = true;
        void Promise.all([listMemories(), getMemorySettings()]).then(([page, nextSettings]) => {
            if (!active) return;
            setMemories(page.memories);
            setCursor(page.nextCursor);
            setSettings(nextSettings);
        }).catch((caught) => {
            if (active) setError(caught instanceof ApiServiceError && caught.code === "memory_not_available" ? "La memoria aún no está habilitada para esta cuenta." : "No se pudo cargar la memoria.");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const pause = async () => {
        if (!settings || busy) return;
        setBusy(true); setError("");
        try { setSettings(await setMemoryPaused(!settings.paused)); }
        catch { setError("No se pudo cambiar el ajuste. Inténtalo otra vez."); }
        finally { setBusy(false); }
    };
    const forget = async (id: string) => {
        if (busy) return;
        setBusy(true); setError("");
        try { await forgetMemory(id); setMemories((current) => current.filter((memory) => memory.id !== id)); setConfirmForget(null); }
        catch { setError("No se pudo olvidar ese recuerdo. Inténtalo otra vez."); }
        finally { setBusy(false); }
    };
    const more = async () => {
        if (!cursor || busy) return;
        setBusy(true); setError("");
        try { const page = await listMemories(cursor); setMemories((current) => [...current, ...page.memories.filter((item) => !current.some((seen) => seen.id === item.id))]); setCursor(page.nextCursor); }
        catch { setError("No se pudieron cargar más recuerdos."); }
        finally { setBusy(false); }
    };

    return <aside ref={panel} role="complementary" aria-label="Memoria privada" className="flu-deliverable-panel flu-memory-panel">
        <header className="flu-deliverable-panel-header"><div><p>MEMORIA PRIVADA</p><h2>Lo que recuerdas entre chats</h2></div><button type="button" onClick={onClose} aria-label="Cerrar memoria">×</button></header>
        <div className="flu-deliverable-panel-content">
            <p className="flu-memory-help">Estos recuerdos son frases tuyas no verificadas. No se convierten en datos del proyecto ni se comparten con otros usuarios.</p>
            {loading ? <p role="status" className="flu-memory-help">Cargando memoria…</p> : null}
            {error ? <p role="alert" className="flu-memory-error">{error}</p> : null}
            {settings ? <div className="flu-memory-setting"><div><strong>Guardar nuevos recuerdos</strong><p>{settings.paused ? "En pausa. Lo ya guardado sigue usándose." : "Activo. Puedes pausar el guardado en cualquier momento."}</p></div><button type="button" onClick={() => void pause()} disabled={busy}>{settings.paused ? "Reanudar" : "Pausar"}</button></div> : null}
            {!loading && settings && !memories.length ? <p className="flu-memory-help">Aún no hay recuerdos guardados.</p> : null}
            <ul className="flu-memory-list">{memories.map((memory) => <li key={memory.id}>
                <p>{memory.text}</p><small>No verificado · {memory.scope === "personal" ? "Personal" : memory.scope === "project" ? "Este proyecto" : "Este chat"}</small>
                <div className="flu-memory-actions"><Link to={`/flu?chat=${encodeURIComponent(memory.originChatId)}`} onClick={onClose}>Origen: {memory.originChatTitle || "Abrir chat"}</Link><button type="button" disabled={busy} onClick={() => setConfirmForget(memory.id)}>Olvidar</button></div>
                {confirmForget === memory.id ? <div className="flu-memory-confirm"><p>Flu dejará de usar este recuerdo y el mensaje del que salió no aparecerá en búsquedas desde otros chats, tampoco para otros miembros del proyecto. El mensaje seguirá en el historial de su chat de origen, donde Flu aún puede verlo. Los resúmenes y respuestas anteriores no cambian. No se puede deshacer.</p><button type="button" disabled={busy} onClick={() => void forget(memory.id)}>Sí, olvidar</button><button type="button" disabled={busy} onClick={() => setConfirmForget(null)}>Cancelar</button></div> : null}
            </li>)}</ul>
            {cursor ? <button type="button" disabled={busy} onClick={() => void more()} className="flu-context-action">Ver más recuerdos</button> : null}
        </div>
    </aside>;
}
