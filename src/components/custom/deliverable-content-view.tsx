import type { ReactNode } from "react";
import { ChatMarkdown } from "./chat-markdown";
import type {
    DeliverableJsonContent,
    DiagnosticContent,
    PolicyAnalysisContent,
    PolicyDraftContent,
    UnderstandingContent,
} from "@/services/v2/types";
import { AnnotatedNarrative, ResultCard, SectionTitle } from "./deliverable-results/shared";

type UnderstandingContentCompatible = UnderstandingContent & {
    schemaVersion: "understanding-v1" | "understanding-v2";
    flujo?: unknown[] | null;
    generacion?: unknown;
    textoNoConsiderado?: unknown | null;
};

const FIELD_LABELS: Record<string, string> = {
    accion: "Acción",
    actividad: "Actividad",
    area: "Área",
    evidencia: "Evidencia",
    id: "Identificador",
    justificacion: "Justificación",
    nombre: "Nombre",
    nombrePolitica: "Política",
    participacion: "Participación",
    paso: "Paso",
    prioridad: "Prioridad",
    responsable: "Responsable",
    rol: "Rol",
    rol_en_proceso: "Rol en el proceso",
    tipoPolitica: "Tipo",
};

const PRIMARY_FIELDS = ["accion", "actividad", "observacion", "nombrePolitica", "nombre", "name", "titulo", "title", "area", "rol_en_proceso"];

function humanize(key: string): string {
    if (FIELD_LABELS[key]) return FIELD_LABELS[key];
    return key
        .replace(/_/g, " ")
        .replace(/([a-záéíóú])([A-Z])/g, "$1 $2")
        .replace(/^./, (letter) => letter.toUpperCase());
}

function isVisible(value: unknown): boolean {
    return value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function valueText(value: unknown): string {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
    if (Array.isArray(value)) return value.map(valueText).filter(Boolean).join(" · ");
    if (value && typeof value === "object") {
        return Object.entries(value as Record<string, unknown>)
            .filter(([, nested]) => isVisible(nested))
            .map(([key, nested]) => `${humanize(key)}: ${valueText(nested)}`)
            .join(" · ");
    }
    return "";
}

function StructuredValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
    if (!isVisible(value)) return null;
    if (depth >= 3 || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return <AnnotatedNarrative>{valueText(value)}</AnnotatedNarrative>;
    }
    if (Array.isArray(value)) {
        return (
            <div className="space-y-2">
                {value.map((item, index) => (
                    <div key={index} className="rounded-lg border border-[color:var(--fl-divider)] bg-[color:var(--fl-bg)] px-3 py-2.5">
                        <StructuredValue value={item} depth={depth + 1} />
                    </div>
                ))}
            </div>
        );
    }
    if (value && typeof value === "object") {
        return (
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {Object.entries(value as Record<string, unknown>).filter(([, nested]) => isVisible(nested)).map(([key, nested]) => (
                    <div key={key} className="min-w-0 border-l-2 border-[color:var(--fl-border)] pl-2.5">
                        <dt className="text-[9px] font-bold tracking-wide text-[color:var(--fl-text-4)] uppercase">{humanize(key)}</dt>
                        <dd className="mt-1 text-[11px] leading-4 text-[color:var(--fl-text-3)]"><StructuredValue value={nested} depth={depth + 1} /></dd>
                    </div>
                ))}
            </dl>
        );
    }
    return null;
}

function StructuredItem({ value, index, variant }: { value: unknown; index: number; variant: "default" | "steps" | "people" }) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        const text = valueText(value);
        return (
            <div className="flex gap-3 rounded-xl bg-[color:var(--fl-surface-2)] px-4 py-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--fl-bg)] text-[10px] font-bold text-[color:var(--fl-link)] shadow-sm">{index + 1}</span>
                <div className="min-w-0 text-xs leading-5 text-[color:var(--fl-text-3)]"><AnnotatedNarrative>{text || `Elemento ${index + 1}`}</AnnotatedNarrative></div>
            </div>
        );
    }

    const record = value as Record<string, unknown>;
    const primaryKey = PRIMARY_FIELDS.find((key) => isVisible(record[key]));
    const primary = primaryKey ? valueText(record[primaryKey]) : `Elemento ${index + 1}`;
    const details = Object.entries(record).filter(([key, field]) => key !== primaryKey && key !== "schemaVersion" && isVisible(field));
    const badge = variant === "people" ? primary.slice(0, 1).toUpperCase() : String(record.paso ?? index + 1);

    return (
        <article className="relative overflow-hidden rounded-xl bg-[color:var(--fl-surface-2)] p-4">
            <div className="flex items-start gap-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${variant === "people" ? "bg-[color:var(--fl-success-bg)] text-[color:var(--fl-success-text)]" : "bg-[color:var(--fl-primary-subtle)] text-[color:var(--fl-link)]"}`}>
                    {badge}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[13px] leading-5 font-semibold text-[color:var(--fl-text-2)]"><AnnotatedNarrative>{primary}</AnnotatedNarrative></div>
                    {details.length ? (
                        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                            {details.map(([key, field]) => (
                                <div key={key} className="min-w-0 border-l-2 border-[color:var(--fl-border)] pl-2.5">
                                    <dt className="text-[9px] font-bold tracking-wide text-[color:var(--fl-text-4)] uppercase">{humanize(key)}</dt>
                                    <dd className="mt-1 text-[11px] leading-4 text-[color:var(--fl-text-3)]"><StructuredValue value={field} /></dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}
                </div>
            </div>
        </article>
    );
}

function StructuredList({ values, empty = "Sin elementos registrados.", variant = "default" }: { values: unknown[]; empty?: string; variant?: "default" | "steps" | "people" }) {
    if (!values.length) return <p className="text-xs text-[color:var(--fl-text-4)]">{empty}</p>;
    return <div className="space-y-2.5">{values.map((value, index) => <StructuredItem key={index} value={value} index={index} variant={variant} />)}</div>;
}

function HeroSummary({ eyebrow, title, children, tone = "blue" }: { eyebrow: string; title: string; children: ReactNode; tone?: "blue" | "green" }) {
    const colors = tone === "green"
        ? { line: "var(--fl-success)", wash: "var(--fl-success-bg)", eyebrow: "var(--fl-success-text)" }
        : { line: "var(--fl-primary)", wash: "var(--fl-surface-2)", eyebrow: "var(--fl-link)" };
    return (
        <section className="overflow-hidden rounded-2xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] shadow-[0_10px_28px_rgba(29,62,112,0.08)]">
            <div className="h-1" style={{ background: colors.line }} />
            <div className="p-6 sm:p-7" style={{ background: colors.wash }}>
                <p className="text-[10px] font-bold tracking-[0.14em] uppercase" style={{ color: colors.eyebrow }}>{eyebrow}</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.02em] text-[color:var(--fl-text)]">{title}</h2>
                <div className="mt-3 max-w-5xl text-sm leading-7 text-[color:var(--fl-text-2)]">{children}</div>
            </div>
        </section>
    );
}

function ContentSection({ title, children, tone = "blue", className = "" }: { title: string; children: ReactNode; tone?: "blue" | "green" | "amber" | "violet"; className?: string }) {
    const accents = { blue: "var(--fl-primary)", green: "var(--fl-success)", amber: "var(--fl-warning)", violet: "var(--fl-text-4)" };
    return (
        <ResultCard className={`relative overflow-hidden p-5 ${className}`}>
            <span className="absolute inset-y-0 left-0 w-1" style={{ background: accents[tone] }} />
            <SectionTitle>{title}</SectionTitle>
            {children}
        </ResultCard>
    );
}

function DiagnosticView({ content }: { content: DiagnosticContent }) {
    return (
        <div className="space-y-5">
            <HeroSummary eyebrow="Resumen ejecutivo" title="Resumen del diagnóstico">
                {content.resumenEjecutivo || "El diagnóstico no incluyó un resumen ejecutivo."}
            </HeroSummary>
            <div className="grid gap-4 lg:grid-cols-2">
                <ContentSection title="HIPÓTESIS CONSULTIVA"><p className="text-xs leading-5 text-[color:var(--fl-text-3)]">{content.hipotesisConsultiva || "Sin hipótesis registrada."}</p></ContentSection>
                <ContentSection title="JUICIO PROFESIONAL" tone="violet"><p className="text-xs leading-5 text-[color:var(--fl-text-3)]">{content.juicioProfesional || "Sin juicio profesional registrado."}</p></ContentSection>
            </div>
            {content.dimensions.length >= 6 ? (
                <ContentSection title="DETALLE POR DIMENSIÓN">
                    <div className="grid gap-3 md:grid-cols-2">
                        {content.dimensions.map((dimension) => (
                            <div key={dimension.id} className="rounded-xl bg-[color:var(--fl-surface-2)] p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <p className="text-xs font-bold text-[color:var(--fl-text-2)]">{dimension.name}</p>
                                    <span className="rounded-full bg-[color:var(--fl-primary-subtle)] px-2 py-1 text-[10px] font-bold text-[color:var(--fl-link)]">{dimension.level}/5</span>
                                </div>
                                <p className="mt-2 text-xs leading-5 text-[color:var(--fl-text-3)]">{dimension.soWhat || dimension.rationale}</p>
                            </div>
                        ))}
                    </div>
                </ContentSection>
            ) : null}
        </div>
    );
}

function UnderstandingView({ content }: { content: UnderstandingContentCompatible }) {
    const flow = Array.isArray(content.flujo) ? content.flujo : [];
    const hasUnconsideredText = isVisible(content.textoNoConsiderado);

    return (
        <div className="space-y-5">
            <HeroSummary eyebrow="Vista general" title="Entendimiento del proceso">
                {content.resumen_ejecutivo || "El entendimiento no incluyó un resumen ejecutivo."}
            </HeroSummary>
            {hasUnconsideredText ? (
                <ContentSection title="CONTENIDO NO CONSIDERADO" tone="amber">
                    <p className="text-xs leading-5 text-[color:var(--fl-warning-text)]">{valueText(content.textoNoConsiderado)}</p>
                </ContentSection>
            ) : null}
            {flow.length ? (
                <ContentSection title="FLUJO DEL PROCESO">
                    <StructuredList values={flow} variant="steps" />
                </ContentSection>
            ) : null}
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
                <ContentSection title="ACTIVIDADES" className="min-h-[260px]"><StructuredList values={content.actividades_secuenciales} variant="steps" /></ContentSection>
                <ContentSection title="ACTORES" tone="green" className="min-h-[260px]"><StructuredList values={content.actores_proceso} variant="people" /></ContentSection>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                <ContentSection title="RIESGOS IDENTIFICADOS" tone="amber"><StructuredList values={content.riesgos_identificados} /></ContentSection>
                <ContentSection title="OPORTUNIDADES DE MEJORA" tone="green"><StructuredList values={content.oportunidades_mejora} /></ContentSection>
                <ContentSection title="PRÓXIMOS PASOS" tone="violet"><StructuredList values={content.proximos_pasos} variant="steps" /></ContentSection>
            </div>
        </div>
    );
}

function PolicyAnalysisView({ content }: { content: PolicyAnalysisContent }) {
    return (
        <div className="grid gap-4 lg:grid-cols-3">
            <ContentSection title="OBSERVACIONES"><StructuredList values={content.observaciones} /></ContentSection>
            <ContentSection title="NECESIDADES" tone="amber"><StructuredList values={content.necesidades} /></ContentSection>
            <ContentSection title="POLÍTICAS RECOMENDADAS" tone="green"><StructuredList values={content.politicas} /></ContentSection>
        </div>
    );
}

function PolicyDraftView({ content }: { content: PolicyDraftContent }) {
    return (
        <article className="flu-document-page" aria-label={`Documento: ${content.policyName || "Política generada"}`}>
            <header className="flu-document-header"><span>{content.policyCode || "POLÍTICA"}</span><h2>{content.policyName || "Política generada"}</h2>{content.policyType ? <p>{content.policyType}</p> : null}</header>
            {content.objetivo ? <section><h3>Objetivo</h3><p>{content.objetivo}</p></section> : null}
            {content.alcance ? <section><h3>Alcance</h3><p>{content.alcance}</p></section> : null}
            {content.definiciones.length ? <section><h3>Definiciones</h3><ol>{content.definiciones.map((item, index) => <li key={index}>{valueText(item)}</li>)}</ol></section> : null}
            {content.lineamientosGenerales.length ? <section><h3>Lineamientos generales</h3><ol>{content.lineamientosGenerales.map((item, index) => <li key={index}>{valueText(item)}</li>)}</ol></section> : null}
            {content.lineamientosEspecificos.length ? <section><h3>Lineamientos específicos</h3><ol>{content.lineamientosEspecificos.map((item, index) => <li key={index}>{valueText(item)}</li>)}</ol></section> : null}
            {content.coordinacionInterdepartamental ? <section><h3>Coordinación interdepartamental</h3><p>{valueText(content.coordinacionInterdepartamental)}</p></section> : null}
            {content.responsables && Object.keys(content.responsables).length ? <section><h3>Responsables</h3><dl>{Object.entries(content.responsables).map(([role, responsibility]) => <div key={role}><dt>{humanize(role)}</dt><dd>{valueText(responsibility)}</dd></div>)}</dl></section> : null}
            {content.otrasDisposiciones ? <section><h3>Otras disposiciones</h3><p>{valueText(content.otrasDisposiciones)}</p></section> : null}
            {content.sanciones ? <section><h3>Sanciones</h3><p>{valueText(content.sanciones)}</p></section> : null}
            {content.vigencia ? <section><h3>Vigencia</h3><p>{valueText(content.vigencia)}</p></section> : null}
        </article>
    );
}

export function DeliverableContentView({ content }: { content: DeliverableJsonContent }) {
    // El entendimiento v1 y v2 comparten las 21 secciones. Usamos el valor en
    // ejecución para ser compatibles durante el despliegue escalonado del contrato.
    switch (String(content.schemaVersion)) {
        case "document-v1": return content.schemaVersion === "document-v1" ? <ChatMarkdown text={content.markdown} /> : null;
        case "diagnostic-v1": return <DiagnosticView content={content as DiagnosticContent} />;
        case "understanding-v1":
        case "understanding-v2": return <UnderstandingView content={content as UnderstandingContentCompatible} />;
        case "policy-analysis-v1": return <PolicyAnalysisView content={content as PolicyAnalysisContent} />;
        case "policy-draft-v1": return <PolicyDraftView content={content as PolicyDraftContent} />;
        default: return null;
    }
}
