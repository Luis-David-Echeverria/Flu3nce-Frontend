import type { Job } from "@/services/v2/types";
const providerLabel = (provider: string) => ({ openai: "OpenAI", deepseek: "DeepSeek", gamma: "Gamma", assemblyai: "AssemblyAI" })[provider] ?? provider;

const inputLabels: Record<string, string> = { source: "Archivo", transcription: "Transcripción", deliverable: "Entregable", conversation: "Contenido de este chat", contribution: "Aporte del usuario", adopted_from_flu: "Contenido adoptado de Flu3nce" };
const reasons: Record<string, string> = { not_permitted: "Necesita permiso", not_ready: "Todavía se está procesando", read_failed: "Falló la lectura", unreadable: "Sin contenido legible", unsupported_format: "Formato no admitido por esta operación", role_excluded: "Fuera del alcance de esta tarea", user_excluded: "Excluido por tu indicación" };

export function ChatJobDetails({ job }: { job: Job }) {
    const result = job.result;
    const used = result && "inputsUsed" in result ? result.inputsUsed ?? [] : [];
    const skipped = result && "inputsSkipped" in result ? result.inputsSkipped ?? [] : [];
    const action = job.error?.action;
    const hints: Record<string, string> = { retry: "Puedes volver a solicitarlo en el chat.", answer: "Responde en el chat para que Flu3nce pueda continuar.", upload: "Añade el material indicado desde la bandeja.", confirm: "Falta tu confirmación para continuar." };
    return <>
        {result?.resultKind === "package_partial" && result.partialReason ? <p className="flu-source-help">{result.partialReason}</p> : null}
        {job.error?.retryable || (action && hints[action.kind]) ? <p className="flu-source-help">{hints[action?.kind ?? "retry"]}</p> : null}
        {used.length || skipped.length ? <details className="flu-job-inputs"><summary>Ver material utilizado{skipped.length ? ` · ${skipped.length} ${skipped.length === 1 ? "entrada no utilizada" : "entradas no utilizadas"}` : ""}</summary>{used.length ? <><p>Material utilizado</p><ul>{used.map((item, index) => <li key={`${item.kind}:${item.id}:${index}`}>{item.name ?? inputLabels[item.kind] ?? "Contenido utilizado"}{item.version ? ` · versión ${item.version}` : ""}</li>)}</ul></> : null}{skipped.length ? <><p>Material no utilizado</p><ul>{skipped.map((item, index) => <li key={`${item.kind}:${item.id}:${index}`}>{item.name ?? inputLabels[item.kind] ?? "Contenido de la solicitud"} · {reasons[item.reason] ?? "No utilizado; consulta el resultado para conocer el motivo"}{item.providers?.length ? ` · ${item.providers.map(providerLabel).join(", ")}` : ""}</li>)}</ul></> : null}</details> : null}
    </>;
}
