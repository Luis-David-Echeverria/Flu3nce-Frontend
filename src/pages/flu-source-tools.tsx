import { useEffect, useRef, useState } from "react";
import { attachLibrarySource, detachLibrarySource, listChatLibrary, type LibrarySource } from "@/services/v2/chat-library";
import { ApiServiceError } from "@/services/v2/http";
import { getSourcePermissions, setSourcePermission, type Provider, type SourcePermission } from "@/services/v2/source-permissions";
import { uploadSource } from "@/services/v2/sources";
import type { Source } from "@/services/v2/types";

const labels: Record<Provider, string> = { deepseek: "DeepSeek", openai: "OpenAI", gamma: "Gamma", assemblyai: "AssemblyAI" };

export function FluSourceTools({ chatId, projectId, unassigned, canWrite, sources, onSourcesChanged, openLibrarySignal = 0 }: {
    chatId: string; projectId: string; unassigned: boolean; canWrite: boolean; sources: Source[]; onSourcesChanged: () => Promise<void>; openLibrarySignal?: number;
}) {
    const [library, setLibrary] = useState<LibrarySource[]>([]);
    const [libraryCursor, setLibraryCursor] = useState<string | undefined>();
    const [libraryAvailable, setLibraryAvailable] = useState(false);
    const [libraryLoading, setLibraryLoading] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [permissionAvailable, setPermissionAvailable] = useState(false);
    const [permissionSourceId, setPermissionSourceId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<SourcePermission[]>([]);
    const [confirmPermission, setConfirmPermission] = useState<{ provider: Provider; grant: boolean } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const librarySection = useRef<HTMLElement>(null);
    const libraryFileInput = useRef<HTMLInputElement>(null);

    const reloadLibrary = async () => {
        try {
            const page = await listChatLibrary(chatId);
            setLibrary(page.sources); setLibraryCursor(page.nextCursor); setLibraryAvailable(true); setError("");
        } catch (caught) {
            setLibraryAvailable(false);
            if (!(caught instanceof ApiServiceError && caught.code === "library_not_available")) setError("No se pudo cargar la biblioteca. Inténtalo de nuevo.");
        } finally { setLibraryLoading(false); }
    };

    useEffect(() => {
        setLibrary([]); setLibraryOpen(false); setLibraryAvailable(false); setLibraryLoading(false); setPermissionAvailable(false); setPermissionSourceId(null); setError("");
        if (unassigned || !chatId) return;
        let active = true;
        setLibraryLoading(true);
        void listChatLibrary(chatId).then((page) => { if (active) { setLibrary(page.sources); setLibraryCursor(page.nextCursor); setLibraryAvailable(true); } }).catch(() => undefined).finally(() => { if (active) setLibraryLoading(false); });
        return () => { active = false; };
    }, [chatId, unassigned]);

    useEffect(() => {
        if (!openLibrarySignal || unassigned) return;
        setLibraryOpen(true);
        window.requestAnimationFrame(() => librarySection.current?.scrollIntoView?.({ block: "nearest" }));
    }, [openLibrarySignal, unassigned]);

    useEffect(() => {
        if (!sources[0] || !projectId) { setPermissionAvailable(false); return; }
        let active = true;
        void getSourcePermissions(projectId, sources[0].id).then(() => { if (active) setPermissionAvailable(true); }).catch(() => { if (active) setPermissionAvailable(false); });
        return () => { active = false; };
    }, [projectId, sources[0]?.id]);

    const toggleLibrarySource = async (source: LibrarySource) => {
        if (busy || !canWrite) return;
        setBusy(true); setError("");
        try {
            if (source.attached) await detachLibrarySource(chatId, source.id);
            else await attachLibrarySource(chatId, source.id);
            setLibrary((current) => current.map((item) => item.id === source.id ? { ...item, attached: !source.attached } : item));
            await onSourcesChanged();
        } catch { setError("No se pudo cambiar esta fuente. Inténtalo de nuevo."); }
        finally { setBusy(false); }
    };
    const showPermissions = async (sourceId: string) => {
        if (permissionSourceId === sourceId) { setPermissionSourceId(null); return; }
        setBusy(true); setError("");
        try { const list = await getSourcePermissions(projectId, sourceId); setPermissions(list.permissions); setPermissionSourceId(sourceId); }
        catch (caught) { if (caught instanceof ApiServiceError && caught.code === "permissions_not_available") setPermissionAvailable(false); else setError("No se pudieron cargar los permisos de este archivo."); }
        finally { setBusy(false); }
    };
    const changePermission = async () => {
        if (!permissionSourceId || !confirmPermission || busy) return;
        setBusy(true); setError("");
        try { const next = await setSourcePermission(projectId, permissionSourceId, confirmPermission.provider, confirmPermission.grant); setPermissions(next.permissions); setConfirmPermission(null); }
        catch { setError("No se pudo cambiar el permiso. Inténtalo de nuevo."); }
        finally { setBusy(false); }
    };
    const addLibraryFiles = async (files: FileList | null) => {
        if (!files?.length || busy || !canWrite) return;
        setBusy(true); setError("");
        try {
            for (const file of Array.from(files)) await uploadSource(projectId, file);
            await reloadLibrary();
            setLibraryOpen(true);
        } catch { setError("No se pudieron subir todos los archivos a la biblioteca. Revisa la lista antes de reintentar."); }
        finally { setBusy(false); }
    };

    return <>
        {sources.length ? <section className="flu-context-section"><h3>Permisos de archivos</h3><p className="flu-source-help">Cada proveedor necesita permiso explícito para recibir el contenido de un archivo.</p>{permissionAvailable ? sources.map((source) => <div key={source.id} className="flu-source-permission-item"><button type="button" onClick={() => void showPermissions(source.id)} disabled={busy} aria-expanded={permissionSourceId === source.id}>{source.name}</button>{permissionSourceId === source.id ? <ul>{permissions.map((permission) => <li key={permission.provider}><span>{labels[permission.provider]} · {permission.granted ? "Permitido" : "Sin permiso"}</span>{canWrite ? <button type="button" disabled={busy} onClick={() => setConfirmPermission({ provider: permission.provider, grant: !permission.granted })}>{permission.granted ? "Revocar" : "Permitir"}</button> : null}</li>)}</ul> : null}</div>) : <p className="flu-context-empty">Los permisos aún no están habilitados para esta cuenta.</p>}</section> : null}
        {confirmPermission ? <div className="flu-source-permission-confirm" role="alertdialog" aria-label="Confirmar permiso de datos"><p>{confirmPermission.grant ? `¿Permitir que ${labels[confirmPermission.provider]} reciba el contenido y el nombre de «${sources.find((item) => item.id === permissionSourceId)?.name ?? "este archivo"}»?` : `¿Revocar el acceso de ${labels[confirmPermission.provider]} a «${sources.find((item) => item.id === permissionSourceId)?.name ?? "este archivo"}»? Las generaciones anteriores no cambian.`}</p><button type="button" disabled={busy} onClick={() => void changePermission()}>Confirmar</button><button type="button" disabled={busy} onClick={() => setConfirmPermission(null)}>Cancelar</button></div> : null}
        {!unassigned ? <section ref={librarySection} id="flu-project-library" className="flu-context-section"><button type="button" className="flu-context-action" aria-expanded={libraryOpen} onClick={() => setLibraryOpen((value) => !value)}>Biblioteca del proyecto {libraryOpen ? "−" : "+"}</button>{libraryOpen ? <><p className="flu-source-help">Solo las fuentes que adjuntes entran en este chat.</p>{libraryLoading ? <p role="status" className="flu-context-empty">Cargando biblioteca…</p> : libraryAvailable ? <>{library.length ? library.map((source) => <div key={source.id} className="flu-source-library-item"><span title={source.name}>{source.name}</span>{canWrite ? <button type="button" disabled={busy} onClick={() => void toggleLibrarySource(source)}>{source.attached ? "Quitar" : "Adjuntar"}</button> : <small>{source.attached ? "Adjunta" : "No adjunta"}</small>}</div>) : <p className="flu-context-empty">No hay fuentes en la biblioteca.</p>}{libraryCursor ? <button type="button" disabled={busy} onClick={() => void listChatLibrary(chatId, libraryCursor).then((page) => { setLibrary((current) => [...current, ...page.sources.filter((item) => !current.some((seen) => seen.id === item.id))]); setLibraryCursor(page.nextCursor); }).catch(() => setError("No se pudieron cargar más fuentes."))} className="flu-context-action">Ver más fuentes</button> : null}{canWrite ? <><input ref={libraryFileInput} type="file" multiple className="sr-only" aria-label="Archivos para la biblioteca" onChange={(event) => { void addLibraryFiles(event.target.files); event.currentTarget.value = ""; }} /><button type="button" disabled={busy} onClick={() => libraryFileInput.current?.click()} className="flu-context-action mt-2">Agregar archivos desde mi equipo</button></> : null}</> : <><p className="flu-context-empty">La biblioteca aún no está habilitada para esta cuenta.</p><button type="button" disabled={busy} onClick={() => { setLibraryLoading(true); void reloadLibrary(); }} className="flu-context-action">Reintentar</button></>}</> : null}</section> : null}
        {error ? <p role="alert" className="flu-memory-error">{error}</p> : null}
    </>;
}
