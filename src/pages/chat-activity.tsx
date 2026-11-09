import { useEffect, useRef, useState } from "react";
import type { ActivityGroup, LiveActivity } from "./chat-stream-state";
import type { ChainBlock } from "@/services/v2/types";

export function durationLabel(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`; }

const visibleCompletedKinds = new Set(["tool", "job", "searching", "transcribing", "ocr", "generating_file", "waiting_provider"]);
export function hasVisibleCompletedActivity(items: LiveActivity[]) {
    return items.some((item) => !!item.jobId || visibleCompletedKinds.has(item.kind));
}

export type ActivityOutcome = "done" | "failed" | "cancelled" | "partial" | "needs_user_input" | "paused";

export function ChatActivity({ items, complete = false, connection, title, outcome }: { items: LiveActivity[]; complete?: boolean; connection?: string; title?: string; outcome?: ActivityOutcome }) {
    const [now, setNow] = useState(Date.now());
    const details = useRef<HTMLDetailsElement>(null);
    const active = !complete && items.some((item) => item.state === "running" || item.state === "pending");
    useEffect(() => { if (!active) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [active]);
    useEffect(() => { if (complete && details.current) details.current.open = false; }, [complete]);
    if (!items.length) return null;
    const current = [...items].reverse().find((item) => item.state === "running" || item.state === "pending") ?? items[items.length - 1];
    const elapsed = current.ms + (active ? Math.max(0, now - current.updatedAt) : 0);
    const lastSeen = Math.max(0, now - current.updatedAt);
    const progress = current.progress;
    const finalState = outcome ?? (items.some((item) => item.state === "failed") ? "failed" : items.some((item) => item.state === "cancelled") ? "cancelled" : "done");
    const symbol = ["failed", "partial"].includes(finalState) ? "!" : finalState === "cancelled" ? "■" : finalState === "paused" ? "Ⅱ" : finalState === "needs_user_input" ? "?" : "✓";
    const finalTitle = finalState === "failed" ? "La actividad terminó con un error" : finalState === "partial" ? "Actividad con resultados parciales" : finalState === "cancelled" ? "Actividad detenida" : finalState === "needs_user_input" ? "Esperando tu respuesta" : finalState === "paused" ? "Trabajo en pausa" : "Actividad terminada";
    return <details ref={details} className={`flu-chat-activity ${active ? "is-active" : "is-complete"}`} aria-label="Actividad de Flu3nce">
        <summary><span aria-hidden="true" className="flu-chat-activity-symbol">{active ? <i /> : symbol}</span><span className="flu-chat-activity-label"><span role={active ? "status" : undefined}>{title ?? (active ? current.label : finalTitle)}</span><small>{active ? <>{current.durationUnknown ? "En curso" : durationLabel(elapsed)}{progress ? ` · ${progress.done} de ${progress.total} ${progress.unit === "page" ? "páginas" : "minutos"}` : ""}{connection === "reconnecting" ? " · Reconectando…" : connection === "offline" ? " · Sin conexión; reintentando…" : current.expectHeartbeat !== false && lastSeen > 30000 ? ` · Sin actualizaciones desde hace ${durationLabel(lastSeen)}; sigue en curso` : ""}</> : `Ver actividad · ${items.length} ${items.length === 1 ? "paso" : "pasos"}`}</small></span><span aria-hidden="true" className="flu-chat-activity-chevron">⌄</span></summary>
        <ol>{items.map((item, index) => <li key={`${item.jobId ?? "turn"}-${item.id}-${index}`}><span aria-hidden="true">{item.state === "done" ? "✓" : item.state === "failed" ? "!" : item.state === "cancelled" ? "■" : "·"}</span><span>{item.label}</span><small>{item.durationUnknown ? "—" : durationLabel(item.ms + (!complete && item.state === "running" ? Math.max(0, now - item.updatedAt) : 0))}</small></li>)}</ol>
    </details>;
}

export function ChainWorkActivity({ activity, connection }: { activity: LiveActivity; connection?: string }) {
    const complete = ["done", "failed", "cancelled", "skipped"].includes(activity.state);
    const stages: LiveActivity[] = (activity.stages ?? []).map((step, index) => ({ id: `${activity.id}:${index}`, label: step.label, kind: step.kind, state: complete && index === (activity.stages?.length ?? 0) - 1 ? activity.state : "done", ms: step.ms ?? 0, durationUnknown: step.ms === null, updatedAt: activity.updatedAt }));
    if (!complete) stages.push({ ...activity, ms: Math.max(0, activity.ms - stages.reduce((sum, item) => sum + item.ms, 0)) });
    if (!stages.length) stages.push(activity);
    return <ChatActivity items={stages} complete={complete} connection={connection} title={complete ? activity.title ?? activity.label : activity.label} outcome={complete ? activity.state === "skipped" ? "done" : activity.state as ActivityOutcome : undefined} />;
}

export function SavedChainActivity({ block }: { block: ChainBlock }) {
    if (!block.final || !block.activities?.length) return null;
    const items = block.activities.flatMap<LiveActivity>((activity) => activity.stages.length ? activity.stages.map((step, index) => ({ id: `${activity.activityId}:${index}`, label: `${activity.label} · ${step.label}`, kind: step.kind, state: index === activity.stages.length - 1 ? activity.state : "done", ms: step.ms ?? 0, durationUnknown: step.ms === null, updatedAt: 0 })) : [{ id: activity.activityId, label: activity.label, kind: "job", state: activity.state, ms: 0, durationUnknown: true, updatedAt: 0 }]);
    return <ChatActivity items={items} complete outcome={block.state === "partial" ? "partial" : block.state === "failed" ? "failed" : "done"} />;
}

export function SavedChatActivity({ group, force = false, title, outcome }: { group: ActivityGroup; force?: boolean; title?: string; outcome?: ActivityOutcome }) {
    const items = group.items.map((item, index) => ({ ...item, id: String(index), kind: item.kind ?? "model_call", updatedAt: 0, jobId: group.jobId }));
    if (!force && !hasVisibleCompletedActivity(items)) return null;
    return <ChatActivity complete items={items} title={title} outcome={outcome} />;
}
