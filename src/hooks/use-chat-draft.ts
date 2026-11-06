import { useCallback, useRef, useState } from "react";

const PREFIX = "flu:draft:";
const MAX_LENGTH = 20000;

type Draft = { userId?: string; scope: string; value: string };

function storageKey(userId: string, scope: string) {
    return `${PREFIX}${userId}:${scope}`;
}

function readDraft(userId: string | undefined, scope: string): string {
    if (!userId) return "";
    try { return window.localStorage.getItem(storageKey(userId, scope)) ?? ""; } catch { return ""; }
}

function writeDraft(userId: string | undefined, scope: string, value: string) {
    if (!userId) return;
    try {
        const key = storageKey(userId, scope);
        if (value.trim()) window.localStorage.setItem(key, value.slice(0, MAX_LENGTH));
        else window.localStorage.removeItem(key);
    } catch { /* Sin almacenamiento, el borrador vive solo mientras la página siga abierta. */ }
}

/** Borra los borradores guardados de una cuenta, por ejemplo al cerrar sesión. */
export function clearStoredDrafts(userId: string | undefined) {
    if (!userId) return;
    try {
        const prefix = `${PREFIX}${userId}:`;
        const keys: string[] = [];
        for (let index = 0; index < window.localStorage.length; index++) {
            const key = window.localStorage.key(index);
            if (key?.startsWith(prefix)) keys.push(key);
        }
        keys.forEach((key) => window.localStorage.removeItem(key));
    } catch { /* Nada que borrar si el almacenamiento no está disponible. */ }
}

/**
 * Borrador del compositor guardado por cuenta y por ámbito (un chat, o el primer mensaje de un
 * proyecto). Sobrevive a cambiar de chat, recargar o volver a iniciar sesión tras caducar.
 */
export function useChatDraft(userId: string | undefined, scope: string) {
    const [state, setState] = useState<Draft>(() => ({ userId, scope, value: readDraft(userId, scope) }));
    let current = state;
    if (state.userId !== userId || state.scope !== scope) {
        current = { userId, scope, value: readDraft(userId, scope) };
        setState(current);
    }
    const latest = useRef(current);
    latest.current = current;

    /** Cambia el borrador del ámbito vigente. */
    const setDraft = useCallback((next: string | ((value: string) => string)) => {
        const base = latest.current;
        const value = typeof next === "function" ? next(base.value) : next;
        latest.current = { ...base, value };
        setState(latest.current);
        writeDraft(base.userId, base.scope, value);
    }, []);

    /** Quita el borrador de `scope` solo si sigue siendo el texto enviado: no borra lo que se escribió después. */
    const clearSent = useCallback((scope: string, sentText: string) => {
        const base = latest.current;
        const sent = sentText.trim();
        if (!sent) return;
        if (base.scope === scope) {
            if (base.value.trim() !== sent) return;
            latest.current = { ...base, value: "" };
            setState(latest.current);
            writeDraft(base.userId, scope, "");
        } else if (readDraft(base.userId, scope).trim() === sent) writeDraft(base.userId, scope, "");
    }, []);

    return { draft: current.value, setDraft, clearSent };
}
