import type { ReactNode } from "react";
import type { SourceUsed } from "@/services/v2/types";

const palette = {
    navy: "var(--fl-text)",
    blue: "var(--fl-primary)",
    sky: "var(--fl-primary-subtle)",
    text: "var(--fl-text)",
    muted: "var(--fl-text-4)",
    border: "var(--fl-border)",
};

export function ResultCard({ children, className = "" }: { children: ReactNode; className?: string }) {
    return (
        <section className={`rounded-2xl border bg-[color:var(--fl-bg)] ${className}`} style={{ borderColor: palette.border }}>
            {children}
        </section>
    );
}

export function ResultHeader({
    eyebrow,
    title,
    description,
    icon,
    actions,
}: {
    eyebrow: string;
    title: string;
    description: string;
    icon: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <ResultCard className="overflow-hidden">
            <div className="h-1 bg-[color:var(--fl-primary)]" />
            <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-4">
                    <div
                        className="flex size-12 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-sm"
                        style={{ background: "var(--fl-primary)" }}
                    >
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold tracking-[0.16em] text-[color:var(--fl-link)]">{eyebrow}</p>
                        <h2 className="mt-1 text-lg font-bold text-[color:var(--fl-text)]">{title}</h2>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--fl-text-4)]">{description}</p>
                    </div>
                </div>
                {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
            </div>
        </ResultCard>
    );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
    return (
        <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-bold tracking-[0.12em] text-[color:var(--fl-text)]">{children}</h3>
            {aside}
        </div>
    );
}

/** Presenta las marcas editoriales del backend como bloques legibles.
 * Acepta tanto `[Evidencia] texto` como `[Evidencia: texto]`.
 */
export function AnnotatedNarrative({ children }: { children: string }) {
    const marker = /\[(Evidencia|Inferencia|Supuesto|Recomendación)(?::\s*([^\]]+))?\]\s*([^\[]*)/gi;
    const matches = [...children.matchAll(marker)];
    if (!matches.length) return <>{children}</>;
    const preface = children.slice(0, matches[0].index).trim();
    return (
        <div className="space-y-2.5">
            {preface ? <p className="text-[color:var(--fl-text-3)]">{preface}</p> : null}
            {matches.map((match, index) => {
                const detail = [match[2], match[3]].filter((part) => part?.trim()).join(" ").trim();
                return (
                    <div key={`${match[1]}-${index}`} className="grid grid-cols-[82px_1fr] items-start gap-2.5 rounded-lg bg-[color:var(--fl-surface-2)] px-3 py-2">
                        <span className="rounded-md bg-[color:var(--fl-primary-subtle)] px-2 py-1 text-center text-[9px] font-bold tracking-wide text-[color:var(--fl-link)] uppercase">{match[1]}</span>
                        <p className="text-[color:var(--fl-text-3)]">{detail}</p>
                    </div>
                );
            })}
        </div>
    );
}

export function MetricCard({
    label,
    value,
    detail,
    tone = "blue",
}: {
    label: string;
    value: ReactNode;
    detail?: string;
    tone?: "blue" | "green" | "amber" | "violet";
}) {
    const colors = {
        blue: ["var(--fl-primary-subtle)", "var(--fl-link)"],
        green: ["var(--fl-success-bg)", "var(--fl-success-text)"],
        amber: ["var(--fl-warning-bg)", "var(--fl-warning-text)"],
        violet: ["var(--fl-hover-strong)", "var(--fl-text-3)"],
    }[tone];
    return (
        <div className="rounded-xl border border-[color:var(--fl-divider)] bg-[color:var(--fl-bg)] p-4">
            <div className="mb-3 h-1 w-8 rounded-full" style={{ background: colors[1] }} />
            <p className="text-[10px] font-semibold tracking-[0.08em] text-[color:var(--fl-text-4)] uppercase">{label}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight" style={{ color: colors[1] }}>
                {value}
            </p>
            {detail && <p className="mt-1 text-[11px] text-[color:var(--fl-text-4)]">{detail}</p>}
        </div>
    );
}

export function Notice({ title, children, tone = "info" }: { title: string; children: ReactNode; tone?: "info" | "warning" | "success" }) {
    const colors = {
        info: { bg: "var(--fl-primary-subtle)", border: "var(--fl-primary-line)", title: "var(--fl-primary-text)", dot: "var(--fl-primary)" },
        warning: { bg: "var(--fl-warning-bg)", border: "var(--fl-warning-bg)", title: "var(--fl-warning-text)", dot: "var(--fl-warning)" },
        success: { bg: "var(--fl-success-bg)", border: "var(--fl-success-bg)", title: "var(--fl-success-text)", dot: "var(--fl-success)" },
    }[tone];
    return (
        <div className="flex gap-3 rounded-xl border p-4" style={{ background: colors.bg, borderColor: colors.border }}>
            <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: colors.dot }} />
            <div>
                <p className="text-xs font-bold" style={{ color: colors.title }}>
                    {title}
                </p>
                <div className="mt-1 text-xs leading-5 text-[color:var(--fl-text-3)]">{children}</div>
            </div>
        </div>
    );
}

const sourceUsedReasons: Record<SourceUsed["reason"], string> = {
    requested: "Se usó la fuente indicada al iniciar la generación.",
    answered: "Se usó la fuente que elegiste al responder la pregunta.",
    single_candidate: "Fue la única fuente utilizable disponible.",
    top_level: "Fue la única fuente utilizable del tipo de fuente preferido.",
};

/** Explica una elección automática o confirmada sin abrir una nueva ronda. */
export function SourceUsedNotice({ source }: { source?: SourceUsed }) {
    if (!source) return null;
    return (
        <Notice title="Fuente utilizada" tone="info">
            <span className="font-semibold text-[color:var(--fl-link)]">{source.label}.</span> {sourceUsedReasons[source.reason]}
        </Notice>
    );
}

export function PrimaryButton({ children, onClick, href, disabled }: { children: ReactNode; onClick?: () => void; href?: string; disabled?: boolean }) {
    const classes =
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[color:var(--fl-primary)] px-4 text-xs font-semibold text-white no-underline transition hover:bg-[color:var(--fl-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50";
    if (href)
        return (
            <a className={classes} href={href} target="_blank" rel="noreferrer">
                {children}
            </a>
        );
    return (
        <button type="button" className={classes} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    );
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-4 text-xs font-semibold text-[color:var(--fl-text)] transition hover:bg-[color:var(--fl-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClick}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

export function FileRow({ name, meta, action }: { name: string; meta?: string; action?: ReactNode }) {
    const ext = name.split(".").pop()?.toUpperCase() ?? "FILE";
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[color:var(--fl-divider)] bg-[color:var(--fl-surface-2)] p-3">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--fl-primary-subtle)] text-[9px] font-bold text-[color:var(--fl-link)]">{ext}</span>
                <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[color:var(--fl-text)]">{name}</p>
                    {meta && <p className="mt-0.5 truncate text-[10px] text-[color:var(--fl-text-4)]">{meta}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

export function formatBytes(value: number): string {
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60);
    return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}
