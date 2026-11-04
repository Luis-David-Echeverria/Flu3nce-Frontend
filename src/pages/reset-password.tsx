import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { PASSWORD_MIN_LENGTH, authService } from "@/services/auth-service";

/**
 * Destino público del enlace enviado por POST /auth/forgot-password.
 * El token nunca se guarda: se lee sólo de la URL y se entrega una vez al endpoint v2.
 */
export const ResetPasswordPage = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token") ?? "";
    const [password, setPassword] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!token) return;

        if (password.length < PASSWORD_MIN_LENGTH) {
            setStatus("error");
            setMessage(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
            return;
        }
        if (password !== confirmation) {
            setStatus("error");
            setMessage("Las contraseñas no coinciden.");
            return;
        }

        setStatus("saving");
        setMessage("");
        try {
            await authService.resetPassword(token, password);
            setStatus("success");
            setPassword("");
            setConfirmation("");
        } catch (error) {
            setStatus("error");
            setMessage(error instanceof Error ? error.message : "No fue posible restablecer la contraseña.");
        }
    };

    const fieldStyle = {
        width: "100%",
        height: 48,
        padding: "0 14px",
        border: "1px solid var(--fl-border-strong)",
        borderRadius: 12,
        fontSize: 15,
        color: "var(--fl-text)",
        background: "var(--fl-bg)",
        outline: "none",
    } as const;

    return (
        <main className="flex min-h-screen items-center justify-center p-6" style={{ background: "var(--fl-bg-subtle)", color: "var(--fl-text)", fontFamily: "var(--fl-font)" }}>
            <section style={{ width: "100%", maxWidth: 430, padding: "36px", borderRadius: 28, background: "var(--fl-bg)", boxShadow: "var(--fl-shadow-float)", border: "1px solid var(--fl-divider)" }}>
                <div style={{ marginBottom: 32 }}><img src="/landing/img/logo-fluence.svg" alt="Flu3nce" className="fl-logo-light h-auto w-[150px]" /><img src="/landing/img/logo-fluence-white.svg" alt="" aria-hidden="true" className="fl-logo-dark h-auto w-[150px]" /></div>
                <h1 style={{ margin: 0, color: "var(--fl-text)", fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em" }}>Restablecer contraseña</h1>

                {!token ? (
                    <>
                        <p style={{ color: "var(--fl-text-3)", fontSize: 14, lineHeight: 1.6, margin: "12px 0 24px" }}>
                            El enlace no es válido o está incompleto. Solicita uno nuevo desde la pantalla de inicio de sesión.
                        </p>
                        <Link to="/login" style={{ color: "var(--fl-link)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Volver a iniciar sesión</Link>
                    </>
                ) : status === "success" ? (
                    <>
                        <p style={{ color: "var(--fl-success-text)", fontSize: 14, lineHeight: 1.6, margin: "12px 0 24px" }}>
                            Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.
                        </p>
                        <Link to="/login" style={{ color: "var(--fl-link)", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Ir a iniciar sesión</Link>
                    </>
                ) : (
                    <form onSubmit={submit} style={{ marginTop: 24 }}>
                        <p style={{ color: "var(--fl-text-3)", fontSize: 14, lineHeight: 1.6, margin: "0 0 20px" }}>
                            Elige una contraseña nueva de al menos {PASSWORD_MIN_LENGTH} caracteres.
                        </p>
                        <label style={{ display: "block", color: "var(--fl-text-2)", fontSize: 14, fontWeight: 500, marginBottom: 7 }}>
                            Contraseña nueva
                            <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={PASSWORD_MIN_LENGTH} required style={{ ...fieldStyle, marginTop: 7 }} />
                        </label>
                        <label style={{ display: "block", color: "var(--fl-text-2)", fontSize: 14, fontWeight: 500, marginTop: 16, marginBottom: 7 }}>
                            Confirmar contraseña
                            <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={PASSWORD_MIN_LENGTH} required style={{ ...fieldStyle, marginTop: 7 }} />
                        </label>
                        {status === "error" && (
                            <p role="alert" style={{ margin: "16px 0 0", padding: "10px 12px", borderRadius: 10, color: "var(--fl-error-text)", fontSize: 13, background: "var(--fl-error-bg)", border: "1px solid var(--fl-error-border)" }}>{message}</p>
                        )}
                        <button type="submit" disabled={status === "saving"} style={{ width: "100%", height: 48, marginTop: 22, background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: status === "saving" ? "wait" : "pointer", opacity: status === "saving" ? 0.65 : 1 }}>
                            {status === "saving" ? "Actualizando..." : "Guardar contraseña"}
                        </button>
                    </form>
                )}
            </section>
        </main>
    );
};
