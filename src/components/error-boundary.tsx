import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children: ReactNode;
}
interface State {
    hasError: boolean;
    message?: string;
}

/**
 * Red de seguridad de la app. Captura errores de render/commit de React (incluido
 * el clásico "NotFoundError: Failed to execute 'removeChild'…", que suele venir de
 * la traducción automática del navegador o de una extensión que muta el DOM) y
 * muestra una pantalla amable con opción de recargar, en vez de dejar la app rota.
 */
export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false };

    static getDerivedStateFromError(error: unknown): State {
        return { hasError: true, message: error instanceof Error ? error.message : String(error) };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // Deja rastro en consola para diagnóstico (el stack en prod va minificado).
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    private isTranslationError(): boolean {
        return /removeChild|insertBefore|not a child/i.test(this.state.message ?? "");
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div
                style={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 24,
                    background: "var(--fl-surface-2)",
                    fontFamily: "var(--fl-font)",
                }}
            >
                <div
                    style={{
                        maxWidth: 440,
                        width: "100%",
                        background: "var(--fl-bg)",
                        border: "1px solid var(--fl-border)",
                        borderRadius: 16,
                        padding: "28px 28px 24px",
                        boxShadow: "0 12px 32px rgba(10,31,74,0.10)",
                        textAlign: "center",
                    }}
                >
                    <div
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: "var(--fl-primary-subtle)",
                            color: "var(--fl-text)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto 16px",
                            fontSize: 24,
                            fontWeight: 700,
                        }}
                        aria-hidden
                    >
                        !
                    </div>
                    <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700, color: "var(--fl-text)" }}>
                        Algo salió mal
                    </h1>
                    <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "var(--fl-text-3)" }}>
                        Ocurrió un error inesperado en la página.
                        {this.isTranslationError() && (
                            <>
                                {" "}Si tienes activada la <strong>traducción automática</strong> del navegador,
                                desactívala para esta página: suele ser la causa.
                            </>
                        )}{" "}
                        Recargar normalmente lo resuelve.
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                background: "var(--fl-primary)",
                                color: "#fff",
                                border: "none",
                                borderRadius: 8,
                                padding: "10px 18px",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Recargar página
                        </button>
                        <button
                            onClick={() => { window.location.href = "/"; }}
                            style={{
                                background: "var(--fl-bg)",
                                color: "var(--fl-text)",
                                border: "1.5px solid var(--fl-border)",
                                borderRadius: 8,
                                padding: "10px 18px",
                                fontSize: 14,
                                fontWeight: 600,
                                cursor: "pointer",
                            }}
                        >
                            Ir al inicio
                        </button>
                    </div>
                </div>
            </div>
        );
    }
}
