import { useState } from "react";
import type { Job, PermissionPending } from "@/services/v2/types";
import { setSourcePermission, type Provider } from "@/services/v2/source-permissions";

export const providerLabel = (provider: string) => ({ openai: "OpenAI", deepseek: "DeepSeek", gamma: "Gamma", assemblyai: "AssemblyAI" })[provider] ?? provider;
const supportedProvider = (value: string): value is Provider => ["openai", "deepseek", "gamma", "assemblyai"].includes(value);

type PermissionAction = NonNullable<Job["error"]>["action"];

export function ChatPermissions({ pending = [], action, projectId, canWrite, onGranted }: { pending?: PermissionPending[]; action?: PermissionAction; projectId: string; canWrite: boolean; onGranted?: () => void }) {
    const [granted, setGranted] = useState<Set<string>>(() => new Set());
    const [busy, setBusy] = useState<string>();
    const [error, setError] = useState("");
    const requests: PermissionPending[] = pending.length ? pending : action?.kind === "grant_permission" ? (action.sourceIds ?? []).map((sourceId) => ({ sourceId, providers: action.providers ?? [] })) : [];
    const available = requests.flatMap((source) => source.providers.map((provider) => ({ ...source, provider, key: `${source.sourceId}:${provider}` }))).filter((item, index, items) => !granted.has(item.key) && items.findIndex((other) => other.key === item.key) === index);
    const grant = async (sourceId: string, provider: Provider, key: string) => {
        if (busy || !canWrite) return;
        setBusy(key); setError("");
        try { await setSourcePermission(projectId, sourceId, provider, true); setGranted((current) => new Set(current).add(key)); onGranted?.(); }
        catch { setError("No se pudo conceder el permiso. Inténtalo de nuevo."); }
        finally { setBusy(undefined); }
    };
    if (!available.length) return granted.size ? <p className="flu-source-help" role="status">Permisos actualizados. No se inició una generación nueva.</p> : null;
    return <section className="flu-chat-permissions" aria-label="Permisos pendientes"><p>Estos archivos necesitan permiso para el proveedor indicado:</p><ul>{available.map((item) => <li key={item.key}><span>{item.sourceName ?? "Archivo de esta solicitud"} · {providerLabel(item.provider)}</span>{canWrite && supportedProvider(item.provider) ? <button type="button" disabled={!!busy} onClick={() => void grant(item.sourceId, item.provider as Provider, item.key)}>{busy === item.key ? "Concediendo…" : `Permitir ${providerLabel(item.provider)}`}</button> : null}</li>)}</ul>{error ? <p role="alert">{error}</p> : null}</section>;
}
