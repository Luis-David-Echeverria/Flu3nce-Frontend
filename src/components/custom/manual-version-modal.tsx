import type { ManualVersionConflict } from "@/services/v2/http";
import { DELIVERABLE_LABELS } from "@/services/v2/labels";
import type { DeliverableType } from "@/services/v2/types";

export function ManualVersionModal({ conflicts, busy = false, onCancel, onConfirm }: {
    conflicts: ManualVersionConflict[];
    busy?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--fl-primary-hover)]/50 p-4" role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="manual-version-title" className="w-full max-w-lg rounded-2xl bg-[color:var(--fl-bg)] p-6 shadow-2xl">
                <p className="text-[10px] font-bold tracking-[0.13em] text-[color:var(--fl-link)] uppercase">Confirmación de versión</p>
                <h2 id="manual-version-title" className="mt-2 text-lg font-bold text-[color:var(--fl-text)]">Hay una edición manual vigente</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--fl-text-3)]">
                    Si generas una versión nueva, la edición actual dejará de ser la vigente. Seguirá disponible en el historial.
                </p>
                {conflicts.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                        {conflicts.map((conflict) => {
                            const type = conflict.deliverableType as DeliverableType | undefined;
                            const name = type && DELIVERABLE_LABELS[type] ? DELIVERABLE_LABELS[type] : "Entregable";
                            return (
                                <li key={conflict.deliverableId} className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] px-4 py-3 text-xs text-[color:var(--fl-text-2)]">
                                    <span className="font-bold text-[color:var(--fl-text)]">{name}{conflict.version ? ` · versión ${conflict.version}` : ""}</span>
                                    {conflict.editedBy ? <span className="ml-2">Editada por {conflict.editedBy}</span> : null}
                                    {conflict.editedAt ? <span className="mt-1 block text-[color:var(--fl-text-4)]">{new Date(conflict.editedAt).toLocaleString("es-MX")}</span> : null}
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-[color:var(--fl-border)] px-4 py-2.5 text-xs font-semibold text-[color:var(--fl-text-3)] disabled:opacity-50">Conservar edición</button>
                    <button type="button" disabled={busy} onClick={onConfirm} className="rounded-lg bg-[color:var(--fl-primary)] px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Preparando…" : "Generar nueva versión"}</button>
                </div>
            </div>
        </div>
    );
}
