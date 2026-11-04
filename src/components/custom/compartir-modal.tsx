import { useCallback, useEffect, useState } from "react";
import { addMember, listMembers, removeMember, updateMemberRole, MemberConflictError, type MemberCandidate } from "@/services/v2/members";
import type { Member, Role } from "@/services/v2/types";
import type { V2Project } from "@/services/v2/projects";

interface CompartirModalProps {
    open: boolean;
    projectId: string;
    projectName?: string;
    /** Rol del usuario actual (propietario/editor/lector) — solo el propietario gestiona accesos. */
    miRol?: V2Project["rol"] | null;
    onClose: () => void;
}

const ROLE_LABEL: Record<string, string> = { owner: "Propietario", editor: "Editor", viewer: "Lector" };

/**
 * Comparte un proyecto con otros usuarios y gestiona sus roles (v2 members).
 * En v2 el proyecto ES la unidad de permisos: cada miembro trae su rol; el back filtra
 * por membresía. Lector ve/descarga, editor además sube, no-miembro 403.
 */
export function CompartirModal({ open, projectId, projectName, miRol, onClose }: CompartirModalProps) {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [correo, setCorreo] = useState("");
    const [role, setRole] = useState<Role>("viewer");
    // Cuando el correo resuelve a varias cuentas, el 409 trae los candidatos a elegir.
    const [candidates, setCandidates] = useState<MemberCandidate[] | null>(null);

    const load = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError(null);
        try {
            setMembers(await listMembers(projectId));
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cargar el acceso");
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (open) {
            setCorreo("");
            setRole("viewer");
            setCandidates(null);
            void load();
        }
    }, [open, load]);

    if (!open) return null;

    const canManage = miRol === "propietario";

    const handleInvite = async () => {
        const usuario = correo.trim();
        if (!usuario || busy) return;
        setBusy(true);
        setError(null);
        setCandidates(null);
        try {
            await addMember(projectId, usuario, role);
            setCorreo("");
            await load();
        } catch (err) {
            if (err instanceof MemberConflictError) setCandidates(err.candidates);
            else setError(err instanceof Error ? err.message : "No se pudo invitar al usuario");
        } finally {
            setBusy(false);
        }
    };

    // El usuario eligió una de las cuentas ambiguas: invitar por userId (sin ambigüedad).
    const handlePickCandidate = async (userId: string) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await addMember(projectId, userId, role);
            setCandidates(null);
            setCorreo("");
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo invitar al usuario");
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async (m: Member) => {
        if (busy) return;
        setBusy(true);
        setError(null);
        try {
            await removeMember(projectId, m.userId);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo quitar al usuario");
        } finally {
            setBusy(false);
        }
    };

    const handleRoleChange = async (member: Member, nextRole: Role) => {
        if (busy || member.role === nextRole) return;
        setBusy(true);
        setError(null);
        try {
            await updateMemberRole(projectId, member.userId, nextRole);
            await load();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo cambiar el rol");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            data-flu-anim
            style={{ background: "var(--fl-overlay)", fontFamily: "var(--fl-font)", animation: "flu-overlay-in 0.15s ease-out" }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                data-flu-anim
                style={{ width: "100%", maxWidth: 460, maxHeight: "85vh", display: "flex", flexDirection: "column", background: "var(--fl-bg)", borderRadius: 16, boxShadow: "0 24px 60px rgba(26,62,127,0.25)", overflow: "hidden", animation: "flu-modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)" }}
            >
                {/* Header */}
                <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--fl-border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--fl-link)", textTransform: "uppercase", marginBottom: 4 }}>Compartir proyecto</div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--fl-text)", wordBreak: "break-word" }}>{projectName || "Proyecto"}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", fontSize: 22, lineHeight: 1, color: "var(--fl-text-4)", cursor: "pointer", flexShrink: 0 }}>×</button>
                </div>

                {/* Invitar */}
                {canManage && (
                    <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--fl-divider)", background: "var(--fl-surface-2)" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                type="email"
                                value={correo}
                                onChange={(e) => setCorreo(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") void handleInvite(); }}
                                placeholder="correo del colaborador"
                                style={{ flex: 1, height: 40, padding: "0 12px", border: "1.5px solid var(--fl-border)", borderRadius: 9, fontSize: 13, color: "var(--fl-text)", background: "var(--fl-bg)", outline: "none" }}
                            />
                            <select
                                aria-label="Rol del nuevo colaborador"
                                value={role}
                                onChange={(e) => setRole(e.target.value as Role)}
                                style={{ height: 40, padding: "0 10px", border: "1.5px solid var(--fl-border)", borderRadius: 9, fontSize: 13, color: "var(--fl-text)", background: "var(--fl-bg)", outline: "none", cursor: "pointer" }}
                            >
                                <option value="viewer">Lector</option>
                                <option value="editor">Editor</option>
                            </select>
                            <button
                                type="button"
                                disabled={busy || loading || !correo.trim()}
                                onClick={() => void handleInvite()}
                                style={{ height: 40, padding: "0 16px", background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: busy || !correo.trim() ? "not-allowed" : "pointer", opacity: busy || !correo.trim() ? 0.6 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
                            >
                                {busy ? "..." : "Invitar"}
                            </button>
                        </div>
                        <p style={{ fontSize: 11, color: "var(--fl-text-4)", marginTop: 8 }}>
                            <strong>Lector</strong>: ver y descargar. <strong>Editor</strong>: además subir versiones.
                        </p>

                        {candidates && (
                            <div style={{ marginTop: 12, border: "1px solid var(--fl-warning-bg)", background: "var(--fl-warning-bg)", borderRadius: 10, padding: "10px 12px" }}>
                                <p style={{ fontSize: 12, fontWeight: 700, color: "var(--fl-warning-text)", marginBottom: 8 }}>Ese correo tiene varias cuentas — ¿cuál invitas?</p>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {candidates.map((c) => (
                                        <button
                                            key={c.userId}
                                            type="button"
                                            disabled={busy}
                                            onClick={() => void handlePickCandidate(c.userId)}
                                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", background: "var(--fl-bg)", border: "1px solid var(--fl-border)", borderRadius: 8, cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", textAlign: "left" }}
                                        >
                                            <span style={{ minWidth: 0 }}>
                                                <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--fl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name || c.userId}</span>
                                                <span style={{ fontSize: 11, color: "var(--fl-text-4)" }}>{c.userId}{c.email ? ` · ${c.email}` : ""}{typeof c.projects === "number" ? ` · ${c.projects} proyecto${c.projects !== 1 ? "s" : ""}` : ""}</span>
                                            </span>
                                            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--fl-link)", flexShrink: 0 }}>Invitar →</span>
                                        </button>
                                    ))}
                                </div>
                                <button type="button" onClick={() => setCandidates(null)} style={{ marginTop: 8, background: "none", border: "none", color: "var(--fl-text-4)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                            </div>
                        )}
                    </div>
                )}

                {/* Miembros */}
                <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px 12px" }}>
                    {error && (
                        <div style={{ margin: 12, border: "1px solid var(--fl-error-border)", background: "var(--fl-error-bg)", color: "var(--fl-error-text)", fontSize: 12, borderRadius: 10, padding: "8px 12px" }}>{error}</div>
                    )}

                    {loading ? (
                        <div style={{ padding: "28px", textAlign: "center", color: "var(--fl-text-4)", fontSize: 13 }}>Cargando...</div>
                    ) : (
                        <>
                            <div style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "var(--fl-text-4)", textTransform: "uppercase" }}>
                                Con acceso ({members.length})
                            </div>

                            {members.map((m) => {
                                const display = m.name || m.email || m.userId;
                                return (
                                    <div key={m.userId} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderBottom: "1px solid var(--fl-divider)" }}>
                                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--fl-primary-subtle)", color: "var(--fl-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                                            {display.charAt(0).toUpperCase()}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fl-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{display}</div>
                                            {canManage && m.role !== "owner" ? (
                                                <select
                                                    aria-label={`Rol de ${display}`}
                                                    value={m.role}
                                                    disabled={busy}
                                                    onChange={(event) => void handleRoleChange(m, event.target.value as Role)}
                                                    className="mt-1 rounded-md border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-2 py-1 text-[11px] font-semibold text-[color:var(--fl-text-3)] disabled:opacity-60"
                                                >
                                                    <option value="viewer">Lector</option>
                                                    <option value="editor">Editor</option>
                                                </select>
                                            ) : (
                                                <div style={{ fontSize: 11, color: "var(--fl-text-4)" }}>{ROLE_LABEL[m.role] ?? m.role}</div>
                                            )}
                                        </div>
                                        {canManage && m.role !== "owner" && (
                                            <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => void handleRemove(m)}
                                                style={{ padding: "6px 10px", background: "var(--fl-bg)", color: "var(--fl-error-text)", border: "1px solid var(--fl-error-border)", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1, fontFamily: "inherit" }}
                                            >
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {!canManage && (
                                <p style={{ padding: "12px", fontSize: 12, color: "var(--fl-text-4)" }}>
                                    Solo el propietario puede gestionar los accesos.
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
