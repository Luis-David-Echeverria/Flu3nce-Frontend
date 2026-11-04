// src/pages/login.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { GoogleLogo } from "@/components/base/buttons/social-logos";
import { useAuthContext } from "@/contexts/auth-context";
import { useAuth } from "@/hooks/use-auth";
import { authService } from "@/services/auth-service";

const ANNOUNCEMENTS = [
    {
        tag: "CAPACIDAD",
        icon: <FileTextIcon />,
        title: "Documenta y diagnostica tus procesos",
        subtitle: "Convierte una sesión de trabajo en un proceso documentado y diagnosticado en minutos.",
    },
    {
        tag: "SELF-CONSULTING",
        icon: <BrainIcon />,
        title: "Sé tu propio consultor con apoyo de IA",
        subtitle: "Piensa como consultor de firma de primer nivel sin contratar una.",
    },
    {
        tag: "METODOLOGÍA",
        icon: <TargetIcon />,
        title: "Framework F-L-U-3-N-C-E",
        subtitle: "7 fases que llevan tu operación del As-Is al To-Be inteligente.",
    },
    {
        tag: "DIAGNÓSTICO",
        icon: <LayersIcon />,
        title: "6 dimensiones de análisis organizacional",
        subtitle: "Proceso, tecnología, datos, KPIs, riesgo y estrategia en un solo lugar.",
    },
    {
        tag: "EFICIENCIA",
        icon: <ClockIcon />,
        title: "Hasta 80% menos tiempo en levantamientos",
        subtitle: "Lo que antes tomaba semanas con un consultor, ahora toma horas.",
    },
    {
        tag: "FLUJO COMPLETO",
        icon: <TransformIcon />,
        title: "De la entrevista al entregable",
        subtitle: "Graba una sesión y obtén minuta, diagrama, hallazgos y roadmap automáticamente.",
    },
    {
        tag: "INTELIGENCIA",
        icon: <DatabaseIcon />,
        title: "Memoria organizacional viva",
        subtitle: "Cada diagnóstico aprende del anterior. Tu operación, con contexto acumulado.",
    },
    {
        tag: "OUTPUTS",
        icon: <ChartIcon />,
        title: "Entregables listos para C-level",
        subtitle: "Diagnósticos, roadmaps y business cases en formato ejecutivo, sin reedición.",
    },
];

const SSO_ERROR_MESSAGES: Record<string, string> = {
    domain_not_allowed: "Tu cuenta no pertenece a un dominio autorizado.",
    cancelled: "Cancelaste el inicio de sesión con el proveedor.",
    invalid_token: "No fue posible validar el inicio de sesión. Inténtalo de nuevo.",
    provider_error: "El proveedor de identidad no pudo completar el inicio de sesión.",
};

function shuffled<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export const LoginPage = () => {
    const [userId, setUserId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const { login, loading, error } = useAuth();
    const { setUserFromLogin } = useAuthContext();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [cards] = useState(() => shuffled(ANNOUNCEMENTS));
    const [activeIdx, setActiveIdx] = useState(0);
    const [forgotOpen, setForgotOpen] = useState(false);
    const ssoError = searchParams.get("authError");
    const authError = error
        ?? (ssoError ? SSO_ERROR_MESSAGES[ssoError] ?? "No fue posible iniciar sesión con el proveedor." : null)
        ?? (searchParams.has("sessionExpired") ? "Tu sesión caducó. Inicia sesión de nuevo para continuar." : null);

    useEffect(() => {
        const t = setInterval(() => setActiveIdx((i) => (i + 1) % cards.length), 4000);
        return () => clearInterval(t);
    }, [cards.length]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await login({ userId, password });
            await setUserFromLogin();
            navigate("/");
        } catch {
            // error manejado en el hook
        }
    };

    return (
        <div
            className="flex min-h-screen items-center justify-center p-6"
            style={{ background: "var(--fl-bg-subtle)", color: "var(--fl-text)", fontFamily: "var(--fl-font)" }}
        >
            <div
                className="flex w-full flex-col overflow-hidden rounded-[20px] lg:flex-row"
                style={{
                    maxWidth: 1150,
                    minHeight: 720,
                    background: "var(--fl-bg)",
                    boxShadow: "var(--fl-shadow-float)",
                    border: "1px solid var(--fl-divider)",
                    borderRadius: 28,
                }}
            >
                {/* ── LEFT: Hero ── */}
                <HeroSide cards={cards} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

                {/* ── RIGHT: Form ── */}
                <div
                    className="flex flex-1 flex-col justify-center"
                    style={{ background: "var(--fl-bg)", padding: "64px 56px", borderLeft: "1px solid var(--fl-divider)" }}
                >
                    <div style={{ maxWidth: 380, width: "100%", margin: "0 auto" }}>

                        {/* Badge */}
                        <div
                            className="mb-4 inline-flex items-center gap-2 rounded-full"
                            style={{ padding: "6px 12px", background: "var(--fl-primary-subtle)" }}
                        >
                            <span className="inline-block h-[7px] w-[7px] rounded-full" style={{ background: "var(--fl-primary)" }} />
                            <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, fontWeight: 500, color: "var(--fl-primary-text)", letterSpacing: "0.04em" }}>
                                BIENVENIDO
                            </span>
                        </div>

                        <h2 style={{ fontSize: 32, fontWeight: 600, color: "var(--fl-text)", marginBottom: 8, letterSpacing: "-0.025em" }}>
                            Iniciar sesión
                        </h2>
                        <p style={{ fontSize: 15, color: "var(--fl-text-3)", marginBottom: 36 }}>
                            Accede a tu cuenta corporativa para continuar.
                        </p>

                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                            {/* Usuario */}
                            <div>
                                <label className="mb-2 block" style={{ fontSize: 14, fontWeight: 500, color: "var(--fl-text-2)" }}>
                                    Usuario
                                </label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                                        <UserIcon />
                                    </span>
                                    <input
                                        type="text"
                                        value={userId}
                                        onChange={(e) => setUserId(e.target.value)}
                                        placeholder="nombre.usuario"
                                        required
                                        className="w-full transition-all duration-150"
                                        style={{
                                            height: 48,
                                            padding: "0 14px 0 46px",
                                            border: "1px solid var(--fl-border-strong)",
                                            borderRadius: 12,
                                            fontSize: 15,
                                            color: "var(--fl-text)",
                                            background: "var(--fl-bg)",
                                            outline: "none",
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = "var(--fl-primary)";
                                            e.target.style.boxShadow = "0 0 0 4px var(--fl-primary-subtle)";
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = "var(--fl-border-strong)";
                                            e.target.style.boxShadow = "none";
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Contraseña */}
                            <div>
                                <div className="mb-2 flex items-baseline justify-between">
                                    <label style={{ fontSize: 14, fontWeight: 500, color: "var(--fl-text-2)" }}>
                                        Contraseña
                                    </label>
                                    <a
                                        href="#"
                                        style={{ fontSize: 13, fontWeight: 500, color: "var(--fl-link)", textDecoration: "none" }}
                                        onClick={(e) => { e.preventDefault(); setForgotOpen(true); }}
                                        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </a>
                                </div>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2">
                                        <LockIcon />
                                    </span>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••••"
                                        required
                                        className="w-full transition-all duration-150"
                                        style={{
                                            height: 48,
                                            padding: "0 48px 0 46px",
                                            border: "1px solid var(--fl-border-strong)",
                                            borderRadius: 12,
                                            fontSize: 15,
                                            color: "var(--fl-text)",
                                            background: "var(--fl-bg)",
                                            outline: "none",
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = "var(--fl-primary)";
                                            e.target.style.boxShadow = "0 0 0 4px var(--fl-primary-subtle)";
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = "var(--fl-border-strong)";
                                            e.target.style.boxShadow = "none";
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full p-1.5 text-[color:var(--fl-text-4)] transition hover:bg-[color:var(--fl-hover)] hover:text-[color:var(--fl-text)]"
                                    >
                                        <EyeIcon crossed={showPassword} />
                                    </button>
                                </div>
                            </div>

                            {authError && (
                                <div
                                    className="rounded-xl px-4 py-3"
                                    style={{ border: "1px solid var(--fl-error-border)", background: "var(--fl-error-bg)", color: "var(--fl-error-text)", fontSize: 13 }}
                                >
                                    {authError}
                                </div>
                            )}

                            {/* Mantener sesión */}
                            <label
                                className="mt-1 flex cursor-pointer select-none items-center gap-2"
                                style={{ fontSize: 14, fontWeight: 400, color: "var(--fl-text-3)" }}
                            >
                                <input type="checkbox" style={{ width: 16, height: 16, accentColor: "var(--fl-primary)", cursor: "pointer" }} />
                                Mantener sesión iniciada
                            </label>

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 transition-all duration-150 hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                                style={{
                                    height: 50,
                                    background: "var(--fl-primary)",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: 999,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    letterSpacing: "0.01em",
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) e.currentTarget.style.background = "var(--fl-primary-hover)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = "var(--fl-primary)";
                                }}
                            >
                                {loading ? "Iniciando sesión..." : "Entrar a Flu3nce"}
                                {!loading && <ArrowRightIcon />}
                            </button>

                            {/* Divider SSO */}
                            <div className="flex items-center gap-3" style={{ margin: "4px 0 2px" }}>
                                <div className="flex-1" style={{ height: 1, background: "var(--fl-divider)" }} />
                                <span style={{ fontFamily: "var(--fl-mono)", fontSize: 11, fontWeight: 400, color: "var(--fl-text-4)", letterSpacing: "0.04em" }}>O ACCEDE CON SSO</span>
                                <div className="flex-1" style={{ height: 1, background: "var(--fl-divider)" }} />
                            </div>

                            {/* SSO buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => authService.loginWithGoogle()}
                                    className="flex cursor-pointer items-center justify-center gap-2 transition-all duration-150"
                                    style={{
                                        height: 46,
                                        background: "var(--fl-bg)",
                                        color: "var(--fl-text)",
                                        border: "1px solid var(--fl-border)",
                                        borderRadius: 999,
                                        fontSize: 13,
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--fl-border-strong)";
                                        e.currentTarget.style.background = "var(--fl-hover)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--fl-border)";
                                        e.currentTarget.style.background = "var(--fl-bg)";
                                    }}
                                >
                                    <GoogleLogo />
                                    Google
                                </button>
                                <button
                                    type="button"
                                    onClick={() => authService.loginWithMicrosoft()}
                                    className="flex cursor-pointer items-center justify-center gap-2 transition-all duration-150"
                                    style={{
                                        height: 46,
                                        background: "var(--fl-bg)",
                                        color: "var(--fl-text)",
                                        border: "1px solid var(--fl-border)",
                                        borderRadius: 999,
                                        fontSize: 13,
                                        fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "var(--fl-border-strong)";
                                        e.currentTarget.style.background = "var(--fl-hover)";
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "var(--fl-border)";
                                        e.currentTarget.style.background = "var(--fl-bg)";
                                    }}
                                >
                                    <MicrosoftLogo />
                                    Microsoft
                                </button>
                            </div>

                            {/* Demo link */}
                            <p className="mt-4 text-center" style={{ fontSize: 13, color: "var(--fl-text-4)", lineHeight: 1.5 }}>
                                ¿Aún no tienes acceso?{" "}
                                <a href="#" style={{ color: "var(--fl-link)", fontWeight: 600, textDecoration: "none" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                                    onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                                >
                                    Solicita una demo
                                </a>
                            </p>

                        </form>
                    </div>
                </div>
            </div>

            <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
        </div>
    );
};

/* ─────────────────── Recuperar contraseña (modal) ─────────────────── */

interface ForgotPasswordModalProps {
    open: boolean;
    onClose: () => void;
}

function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (open) {
            setEmail("");
            setStatus("idle");
            setMessage("");
        }
    }, [open]);

    if (!open) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || status === "sending") return;
        setStatus("sending");
        try {
            await authService.forgotPassword(email.trim());
            setMessage("Si la cuenta existe, enviamos un enlace de recuperación al correo asociado.");
            setStatus("sent");
        } catch {
            setMessage("No se pudo enviar la solicitud. Inténtalo de nuevo en un momento.");
            setStatus("error");
        }
    };

    const canSubmit = !!email.trim() && status !== "sending";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            data-flu-anim
            style={{ background: "var(--fl-overlay)", animation: "flu-overlay-in 0.15s ease-out" }}
            onClick={onClose}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                data-flu-anim
                style={{
                    width: "100%",
                    maxWidth: 420,
                    background: "var(--fl-bg)",
                    color: "var(--fl-text)",
                    borderRadius: 24,
                    padding: "32px 32px 28px",
                    boxShadow: "var(--fl-shadow-menu)",
                    fontFamily: "var(--fl-font)",
                    animation: "flu-modal-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
            >
                <h2 style={{ fontSize: 20, fontWeight: 600, color: "var(--fl-text)", marginBottom: 6, letterSpacing: "-0.02em" }}>Recuperar contraseña</h2>

                {status === "sent" ? (
                    <>
                        <p style={{ fontSize: 14, color: "var(--fl-text-3)", lineHeight: 1.6, marginBottom: 24 }}>{message}</p>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{ width: "100%", height: 46, background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                        >
                            Entendido
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <p style={{ fontSize: 14, color: "var(--fl-text-3)", lineHeight: 1.6, marginBottom: 20 }}>
                            Ingresa el correo asociado a tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                        </p>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="correo@empresa.com"
                            autoComplete="email"
                            autoFocus
                            style={{ width: "100%", height: 48, padding: "0 14px", border: "1px solid var(--fl-border-strong)", borderRadius: 12, fontSize: 15, color: "var(--fl-text)", background: "var(--fl-bg)", outline: "none", marginBottom: 12 }}
                            onFocus={(e) => { e.target.style.borderColor = "var(--fl-primary)"; e.target.style.boxShadow = "0 0 0 4px var(--fl-primary-subtle)"; }}
                            onBlur={(e) => { e.target.style.borderColor = "var(--fl-border-strong)"; e.target.style.boxShadow = "none"; }}
                        />
                        {status === "error" && (
                            <div style={{ border: "1px solid var(--fl-error-border)", background: "var(--fl-error-bg)", color: "var(--fl-error-text)", fontSize: 13, borderRadius: 12, padding: "8px 12px", marginBottom: 12 }}>
                                {message}
                            </div>
                        )}
                        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{ flex: 1, height: 46, background: "var(--fl-bg)", color: "var(--fl-text-2)", border: "1px solid var(--fl-border)", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                style={{ flex: 1, height: 46, background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 999, fontSize: 14, fontWeight: 600, cursor: canSubmit ? "pointer" : "not-allowed", opacity: canSubmit ? 1 : 0.6, fontFamily: "inherit" }}
                            >
                                {status === "sending" ? "Enviando..." : "Enviar enlace"}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

/* ─────────────────────────── HeroSide ─────────────────────────── */

interface HeroSideProps {
    cards: typeof ANNOUNCEMENTS;
    activeIdx: number;
    setActiveIdx: (i: number) => void;
}

function HeroSide({ cards, activeIdx, setActiveIdx }: HeroSideProps) {
    return (
        <div
            className="relative flex flex-col justify-between overflow-hidden"
            style={{ flex: "1.15", padding: "148px 56px 40px", background: "var(--fl-bg-subtle)" }}
        >
            {/* Ola plana con la línea de corriente (alternativa C) */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-32" style={{ background: "var(--fl-wave) top / 100% 100% no-repeat" }} />

            <div className="relative z-10 flex h-full flex-col">
                {/* Logo */}
                <div className="mb-11">
                    <img src="/landing/img/logo-fluence.svg" alt="Flu3nce" className="fl-logo-light h-auto w-[170px]" />
                    <img src="/landing/img/logo-fluence-white.svg" alt="" aria-hidden="true" className="fl-logo-dark h-auto w-[170px]" />
                </div>

                {/* Headline */}
                <h1 style={{ fontSize: 38, fontWeight: 600, color: "var(--fl-text)", lineHeight: 1.16, marginBottom: 14, letterSpacing: "-0.03em" }}>
                    Conversa, crea y mejora
                    <br />
                    con <span style={{ color: "var(--fl-primary)" }}>claridad operativa.</span>
                </h1>

                <p style={{ fontSize: 16, color: "var(--fl-text-3)", lineHeight: 1.6, marginBottom: 36, maxWidth: 440 }}>
                    Trabaja con Flu3nce sobre tus fuentes, decisiones y entregables en una sola conversación.
                </p>

                {/* Carousel */}
                <div className="mt-auto mb-7">
                    <div
                        className="relative overflow-hidden rounded-2xl"
                        style={{
                            minHeight: 168,
                            background: "var(--fl-bg)",
                            border: "1px solid var(--fl-border)",
                        }}
                    >
                        {cards.map((card, i) => (
                            <div
                                key={i}
                                className="absolute inset-0 flex items-center gap-5 p-6"
                                style={{
                                    opacity: i === activeIdx ? 1 : 0,
                                    transform: i === activeIdx ? "translateX(0)" : "translateX(20px)",
                                    transition: "opacity 0.6s ease, transform 0.6s ease",
                                    pointerEvents: i === activeIdx ? "auto" : "none",
                                }}
                            >
                                <div
                                    className="relative flex shrink-0 items-center justify-center rounded-full"
                                    style={{
                                        width: 56, height: 56,
                                        background: "var(--fl-primary)",
                                        color: "#fff",
                                    }}
                                >
                                    {card.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <span
                                        className="mb-2 inline-block rounded-full"
                                        style={{
                                            fontFamily: "var(--fl-mono)", fontSize: 10, fontWeight: 500, color: "var(--fl-primary-text)",
                                            letterSpacing: "0.04em", background: "var(--fl-primary-subtle)",
                                            padding: "3px 9px",
                                        }}
                                    >
                                        {card.tag}
                                    </span>
                                    <p style={{ fontSize: 16, fontWeight: 600, color: "var(--fl-text)", marginBottom: 4, letterSpacing: "-0.01em", lineHeight: 1.3 }}>
                                        {card.title}
                                    </p>
                                    <p style={{ fontSize: 14, color: "var(--fl-text-3)", lineHeight: 1.5 }}>{card.subtitle}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Dots */}
                    <div className="mt-4 flex justify-center gap-2">
                        {cards.map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setActiveIdx(i)}
                                aria-label={`Anuncio ${i + 1}`}
                                className="border-none p-0 transition-all duration-300"
                                style={{
                                    width: i === activeIdx ? 20 : 6,
                                    height: 6,
                                    borderRadius: i === activeIdx ? 4 : "50%",
                                    background: i === activeIdx ? "var(--fl-primary)" : "var(--fl-border-strong)",
                                    cursor: "pointer",
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Brand footer */}
            <p className="relative z-10" style={{ fontFamily: "var(--fl-mono)", fontSize: 11, fontWeight: 400, color: "var(--fl-text-4)", letterSpacing: "0.04em" }}>
                POWERED BY BIMCON · MMXXVI
            </p>
        </div>
    );
}

/* ─────────────────────────── Icons ─────────────────────────── */

function UserIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fl-text-4)" }}>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--fl-text-4)" }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    );
}

function EyeIcon({ crossed = false }: { crossed?: boolean }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
            <circle cx="12" cy="12" r="2.7" />
            {crossed ? <path d="m4 4 16 16" /> : null}
        </svg>
    );
}

function ArrowRightIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
    );
}

function FileTextIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}

function BrainIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
        </svg>
    );
}

function TargetIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    );
}

function LayersIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
        </svg>
    );
}

function ClockIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function TransformIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
        </svg>
    );
}

function DatabaseIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v14a9 3 0 0 0 18 0V5" />
            <path d="M3 12a9 3 0 0 0 18 0" />
        </svg>
    );
}

function MicrosoftLogo() {
    return (
        <svg width="16" height="16" viewBox="0 0 23 23">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#7fba00" d="M12 1h10v10H12z" />
            <path fill="#00a4ef" d="M1 12h10v10H1z" />
            <path fill="#ffb900" d="M12 12h10v10H12z" />
        </svg>
    );
}

function ChartIcon() {
    return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
        </svg>
    );
}
