import { useEffect, useMemo, useState } from "react";
import { ReadableQuestionPrompt } from "@/components/custom/readable-question-prompt";
import { listSources, uploadSource } from "@/services/v2/sources";
import type { Question, QuestionGroup, SourceRef } from "@/services/v2/types";

const btnPrimary: React.CSSProperties = {
    height: 42, padding: "0 22px", background: "var(--fl-primary)", color: "#fff", border: "none", borderRadius: 10,
    fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};

type ConversationQuestion = Question;
type SelectableSource = Pick<SourceRef, "id" | "name">;

export function ConsultationQuestions({ group, projectId, onAnswer }: {
    group: QuestionGroup;
    projectId: string;
    onAnswer: (answers: { questionId: string; value: unknown }[]) => Promise<void>;
}) {
    return (
        <NeedsInput
            questions={group.questions}
            projectId={projectId}
            onAnswer={onAnswer}
            title={group.title}
            whatIsMissing={group.whatIsMissing}
            whyItMatters={group.whyItMatters}
            sourceCandidates={group.sourceCandidates}
        />
    );
}

function NeedsInput({ questions, projectId, onAnswer, title, whatIsMissing, whyItMatters, sourceCandidates }: {
    questions: Question[];
    projectId?: string;
    onAnswer: (answers: { questionId: string; value: unknown }[]) => Promise<void>;
    title?: string;
    whatIsMissing?: string;
    whyItMatters?: string;
    sourceCandidates?: QuestionGroup["sourceCandidates"];
}) {
    const [values, setValues] = useState<Record<string, unknown>>({});
    const [projectSources, setProjectSources] = useState<SelectableSource[]>([]);
    const [sourcesLoading, setSourcesLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const set = (id: string, v: unknown) => setValues((p) => ({ ...p, [id]: v }));
    const hasValue = (value: unknown) => value !== undefined && value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
    const complete = questions.every((question) => question.required === false || hasValue(values[question.id]));
    const questionGroups = useMemo(() => {
        const typed = questions as ConversationQuestion[];
        const exceptions = new Map<string, ConversationQuestion[]>();
        const primary: ConversationQuestion[] = [];
        for (const question of typed) {
            if (question.overrides) {
                const nested = exceptions.get(question.overrides) ?? [];
                nested.push(question);
                exceptions.set(question.overrides, nested);
            } else {
                primary.push(question);
            }
        }
        // Si un backend publica una excepción sin la pregunta principal, nunca se
        // oculta: se muestra como una pregunta autónoma y el usuario puede avanzar.
        for (const [parentId, nested] of exceptions) {
            if (!typed.some((question) => question.id === parentId)) primary.push(...nested);
        }
        return primary.map((question) => ({ question, exceptions: exceptions.get(question.id) ?? [] }));
    }, [questions]);

    useEffect(() => {
        if (!projectId || !questions.some((question) => question.kind === "file" || question.kind === "files")) return;
        if (sourceCandidates) {
            const sources = Array.from(new Map(sourceCandidates.flatMap((entry) => entry.sources).map((source) => [source.id, { id: source.id, name: source.name }])).values());
            setProjectSources(sources);
            setValues((current) => {
                const next = { ...current };
                for (const question of questions) {
                    if ((question.kind !== "file" && question.kind !== "files") || hasValue(next[question.id])) continue;
                    const allowedIds = sourceCandidates.find((entry) => entry.questionId === question.id)?.sources.map((source) => source.id) ?? [];
                    if (allowedIds.length === 1) next[question.id] = question.kind === "file" ? allowedIds[0] : allowedIds;
                }
                return next;
            });
            return;
        }
        let cancelled = false;
        setSourcesLoading(true);
        listSources(projectId, { limit: 100 })
            .then(({ sources }) => {
                if (cancelled) return;
                setProjectSources(sources);
                setValues((current) => {
                    const next = { ...current };
                    for (const question of questions) {
                        if ((question.kind !== "file" && question.kind !== "files") || hasValue(next[question.id])) continue;
                        const eligible = sources.filter((source) => sourceMatchesQuestion(source, question));
                        if (eligible.length === 1) next[question.id] = question.kind === "file" ? eligible[0].id : [eligible[0].id];
                    }
                    return next;
                });
            })
            .catch(() => {
                if (!cancelled) setProjectSources([]);
            })
            .finally(() => {
                if (!cancelled) setSourcesLoading(false);
            });
        return () => { cancelled = true; };
    }, [projectId, questions, sourceCandidates]);

    const submit = async () => {
        setBusy(true);
        setErr(null);
        try {
            const resolved = await Promise.all(questions.map(async (q) => {
                const value = values[q.id];
                if (q.kind !== "file" && q.kind !== "files") return { questionId: q.id, value };
                if (q.required === false && !hasValue(value)) return { questionId: q.id, value: undefined };
                if (!projectId) throw new Error("No se pudo identificar el proyecto donde subir el archivo.");

                if (q.kind === "file") {
                    if (typeof value === "string") return { questionId: q.id, value };
                    if (!(value instanceof File)) throw new Error("Selecciona el archivo solicitado.");
                    const source = await uploadSource(projectId, value);
                    return { questionId: q.id, value: source.id };
                }

                if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
                    return { questionId: q.id, value };
                }
                const files = Array.isArray(value) ? value.filter((item): item is File => item instanceof File) : [];
                if (files.length === 0) throw new Error("Selecciona al menos un archivo.");
                const sources = await Promise.all(files.map((file) => uploadSource(projectId, file)));
                return { questionId: q.id, value: sources.map((source) => source.id) };
            }));

            // Si answers falla, conservar los sourceId evita volver a subir los
            // mismos binarios al reintentar.
            setValues(Object.fromEntries(resolved.map((answer) => [answer.questionId, answer.value])));
            await onAnswer(resolved);
        } catch (e) {
            const localMessage = e instanceof Error ? e.message : "";
            const isLocalValidation = /^(Selecciona|No se pudo identificar el proyecto)/.test(localMessage);
            setErr(isLocalValidation ? localMessage : "No pudimos guardar tus respuestas. Intenta nuevamente.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <section aria-label="Consulta de Flu3nce" className="mx-auto w-full max-w-3xl px-4 py-7 sm:px-7 sm:py-9">
            <div className="overflow-hidden rounded-2xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] shadow-[0_12px_32px_rgba(29,62,112,0.08)]">
                <header className="flex items-center gap-3 border-b border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-5 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--fl-primary)] text-xs font-extrabold text-white">F</div>
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-[color:var(--fl-text)]">Flu3nce</p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--fl-text-4)]">Estoy acompañando la generación de este artefacto.</p>
                    </div>
                    <span className="ml-auto shrink-0 rounded-full bg-[color:var(--fl-warning-bg)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--fl-warning-text)]">Espero tu decisión</span>
                </header>

                <div className="space-y-4 p-5 sm:p-6">
                    <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] px-4 py-3 text-sm leading-6 text-[color:var(--fl-text-2)] shadow-sm">
                        <p className="font-semibold text-[color:var(--fl-text)]">{title ?? `Para continuar sin hacer suposiciones, necesito confirmar ${questions.length === 1 ? "un dato" : `${questions.length} datos`} contigo.`}</p>
                        <p className="mt-1 text-xs leading-5 text-[color:var(--fl-text-4)]">{whatIsMissing ?? "Responde aquí mismo. Conservaré los resultados y versiones que ya estén listos."}</p>
                        {whyItMatters ? <p className="mt-2 text-xs leading-5 text-[color:var(--fl-text-3)]">{whyItMatters}</p> : null}
                    </div>
                    <div className="space-y-3">
                        {questionGroups.map(({ question, exceptions }) => (
                            <ConversationQuestionCard
                                key={question.id}
                                question={question}
                                exceptions={exceptions}
                                values={values}
                                onChange={set}
                                projectSources={projectSources}
                                sourcesLoading={sourcesLoading}
                                sourceCandidates={sourceCandidates}
                            />
                        ))}
                    </div>

                    {err && <p className="rounded-lg border border-[color:var(--fl-error-border)] bg-[color:var(--fl-error-bg)] px-3 py-2 text-xs text-[color:var(--fl-error-text)]">{err}</p>}
                    <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--fl-border)] pt-4">
                        <button type="button" aria-label="Continuar" onClick={submit} disabled={busy || !complete} style={{ ...btnPrimary, opacity: busy || !complete ? 0.6 : 1, cursor: busy || !complete ? "not-allowed" : "pointer" }}>
                            {busy ? "Guardando respuestas…" : "Continuar con estas respuestas"}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ConversationQuestionCard({
    question,
    exceptions,
    values,
    onChange,
    projectSources,
    sourcesLoading,
    sourceCandidates,
}: {
    question: ConversationQuestion;
    exceptions: ConversationQuestion[];
    values: Record<string, unknown>;
    onChange: (id: string, value: unknown) => void;
    projectSources: SelectableSource[];
    sourcesLoading: boolean;
    sourceCandidates?: QuestionGroup["sourceCandidates"];
}) {
    return (
        <article className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] p-4 shadow-[0_2px_6px_rgba(29,62,112,0.03)]">
            <QuestionFields question={question} value={values[question.id]} onChange={(value) => onChange(question.id, value)} projectSources={projectSources} sourcesLoading={sourcesLoading} sourceCandidates={sourceCandidates} />
            {question.steps?.length ? (
                <div className="mt-3 border-t border-[color:var(--fl-divider)] pt-3">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-[color:var(--fl-text-4)] uppercase">Aplica a estos pasos</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {question.steps.map((step, index) => <span key={`${question.id}-${index}`} className="rounded-full bg-[color:var(--fl-primary-subtle)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--fl-link)]">Paso {step}</span>)}
                    </div>
                </div>
            ) : null}
            {exceptions.length ? (
                <details className="mt-3 rounded-lg border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] p-3">
                    <summary className="cursor-pointer text-xs font-bold text-[color:var(--fl-link)]">Este paso tiene un responsable distinto</summary>
                    <div className="mt-3 space-y-4">
                        {exceptions.map((exception) => (
                            <QuestionFields key={exception.id} question={exception} value={values[exception.id]} onChange={(value) => onChange(exception.id, value)} projectSources={projectSources} sourcesLoading={sourcesLoading} sourceCandidates={sourceCandidates} nested />
                        ))}
                    </div>
                </details>
            ) : null}
        </article>
    );
}

function QuestionFields({ question, value, onChange, projectSources, sourcesLoading, sourceCandidates, nested = false }: {
    question: ConversationQuestion;
    value: unknown;
    onChange: (value: unknown) => void;
    projectSources: SelectableSource[];
    sourcesLoading: boolean;
    sourceCandidates?: QuestionGroup["sourceCandidates"];
    nested?: boolean;
}) {
    return (
        <div>
            <div className="mb-2 flex items-start justify-between gap-3">
                <div id={`question-prompt-${question.id}`} className={`flu-question-prompt min-w-0 ${nested ? "text-xs" : "text-[13px]"} font-semibold leading-5 text-[color:var(--fl-text)]`}><ReadableQuestionPrompt prompt={question.prompt} /></div>
                {question.required === false ? <span className="shrink-0 rounded-full bg-[color:var(--fl-hover-strong)] px-2 py-1 text-[9px] font-bold text-[color:var(--fl-text-4)]">Opcional</span> : null}
            </div>
            <QuestionInput q={question} value={value} onChange={onChange} projectSources={projectSources} sourcesLoading={sourcesLoading} sourceCandidates={sourceCandidates} />
            {question.required === false ? <p className="mt-1.5 text-[10px] text-[color:var(--fl-text-4)]">Puedes dejar esta pregunta sin responder.</p> : null}
        </div>
    );
}

const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 12px", border: "1.5px solid var(--fl-border)", borderRadius: 9,
    fontSize: 13, color: "var(--fl-text)", background: "var(--fl-surface-2)", outline: "none", fontFamily: "inherit",
};

function allowedExtensions(q: Question): string[] {
    return q.allowedExtensions
        ?.map((extension) => extension.trim().replace(/^\*\./, "."))
        .filter(Boolean)
        .map((extension) => extension.startsWith(".") ? extension.toLowerCase() : `.${extension.toLowerCase()}`) ?? [];
}

function sourceMatchesQuestion(source: SelectableSource, q: Question): boolean {
    const extensions = allowedExtensions(q);
    return extensions.length === 0 || extensions.some((extension) => source.name.toLowerCase().endsWith(extension));
}

function QuestionInput({ q, value, onChange, projectSources, sourcesLoading, sourceCandidates }: { q: Question; value: unknown; onChange: (v: unknown) => void; projectSources: SelectableSource[]; sourcesLoading: boolean; sourceCandidates?: QuestionGroup["sourceCandidates"] }) {
    if (q.kind === "file" || q.kind === "files") {
        const extensions = allowedExtensions(q);
        const candidateIds = sourceCandidates?.find((entry) => entry.questionId === q.id)?.sources.map((source) => source.id);
        const eligibleSources = projectSources.filter((source) => sourceMatchesQuestion(source, q) && (!candidateIds || candidateIds.includes(source.id)));
        const sourceIds = typeof value === "string"
            ? [value]
            : Array.isArray(value)
                ? value.filter((item): item is string => typeof item === "string")
                : [];
        const selected = value instanceof File
            ? [value]
            : Array.isArray(value)
                ? value.filter((item): item is File => item instanceof File)
                : [];
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sourcesLoading ? <span className="text-[11px] text-[color:var(--fl-text-4)]">Buscando fuentes existentes…</span> : null}
                {!sourcesLoading && eligibleSources.length > 0 ? (
                    <div className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] p-3">
                        <p className="mb-2 text-[10px] font-bold tracking-wide text-[color:var(--fl-text-4)] uppercase">Fuentes del proyecto</p>
                        <div className="flex flex-col gap-2">
                            {eligibleSources.map((source) => {
                                const active = sourceIds.includes(source.id);
                                return (
                                    <button
                                        key={source.id}
                                        type="button"
                                        onClick={() => {
                                            if (q.kind === "file") onChange(source.id);
                                            else onChange(active ? sourceIds.filter((id) => id !== source.id) : [...sourceIds, source.id]);
                                        }}
                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${active ? "border-[color:var(--fl-primary)] bg-[color:var(--fl-primary-subtle)] text-[color:var(--fl-link)]" : "border-[color:var(--fl-border)] bg-[color:var(--fl-bg)] text-[color:var(--fl-text-3)] hover:border-[color:var(--fl-primary-line)]"}`}
                                    >
                                        <span className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${active ? "border-[color:var(--fl-primary)] bg-[color:var(--fl-primary)] text-white" : "border-[color:var(--fl-border-strong)]"}`}>{active ? "✓" : ""}</span>
                                        <span className="min-w-0 flex-1 truncate">{source.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
                <input
                    id={`question-file-${q.id}`}
                    type="file"
                    multiple={q.kind === "files"}
                    accept={extensions?.join(",")}
                    onChange={(event) => {
                        const files = Array.from(event.currentTarget.files ?? []);
                        onChange(q.kind === "file" ? files[0] : files);
                    }}
                    className="sr-only"
                />
                <label
                    htmlFor={`question-file-${q.id}`}
                    className="flex min-h-11 cursor-pointer items-center justify-center rounded-[9px] border border-dashed border-[color:var(--fl-border-strong)] bg-[color:var(--fl-surface-2)] px-4 text-xs font-semibold text-[color:var(--fl-link)] transition hover:border-[color:var(--fl-primary)] hover:bg-[color:var(--fl-primary-subtle)]"
                >
                    {eligibleSources.length > 0 ? "Subir otro archivo" : q.kind === "files" ? "Elegir archivos" : "Elegir archivo"}
                </label>
                {extensions.length ? (
                    <span style={{ fontSize: 11, color: "var(--fl-text-4)" }}>Formatos permitidos: {extensions.join(", ")}</span>
                ) : null}
                {selected.length > 0 ? (
                    <span style={{ fontSize: 11, color: "var(--fl-success-text)" }}>
                        {selected.map((file) => file.name).join(", ")}
                    </span>
                ) : null}
            </div>
        );
    }
    if (q.kind === "boolean") {
        return (
            <div style={{ display: "flex", gap: 8 }}>
                {[{ v: true, l: "Sí" }, { v: false, l: "No" }].map((o) => (
                    <button key={o.l} type="button" onClick={() => onChange(o.v)}
                        style={{ flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${value === o.v ? "var(--fl-primary)" : "var(--fl-border)"}`, background: value === o.v ? "var(--fl-primary-subtle)" : "#fff", color: "var(--fl-text)" }}>
                        {o.l}
                    </button>
                ))}
            </div>
        );
    }
    if (q.kind === "single_choice" && q.options) {
        return <SingleChoiceInput q={q} value={value} onChange={onChange} />;
    }
    if (q.kind === "multi_choice" && q.options) {
        const arr = Array.isArray(value) ? (value as string[]) : [];
        const toggle = (opt: string) => onChange(arr.includes(opt) ? arr.filter((x) => x !== opt) : [...arr, opt]);
        if (q.options.length > 8) return <div className="flu-question-many-options">
            <select multiple size={6} aria-label={q.prompt} value={arr} onChange={(event) => onChange(Array.from(event.target.selectedOptions, (option) => option.value))} style={{ ...inputStyle, height: "auto" }}>{q.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
            {arr.length ? <p>{arr.join("; ")}</p> : <small>Selecciona las opciones que correspondan.</small>}
        </div>;
        return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {q.options.map((opt) => (
                    <button key={opt} type="button" onClick={() => toggle(opt)}
                        style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${arr.includes(opt) ? "var(--fl-primary)" : "var(--fl-border)"}`, background: arr.includes(opt) ? "var(--fl-primary-subtle)" : "#fff", color: "var(--fl-text)" }}>
                        {opt}
                    </button>
                ))}
            </div>
        );
    }
    if (q.kind === "number") {
        const presentation = q as Question & { min?: number; max?: number; step?: number; unit?: string; ui?: "slider" | "number" };
        const hasRange = Number.isFinite(presentation.min) && Number.isFinite(presentation.max) && (presentation.max as number) > (presentation.min as number);
        if (hasRange && presentation.ui !== "number") {
            const min = presentation.min as number;
            const max = presentation.max as number;
            const current = typeof value === "number" ? value : min;
            return (
                <div className="rounded-xl border border-[color:var(--fl-border)] bg-[color:var(--fl-surface-2)] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-semibold text-[color:var(--fl-text-4)]">{min}{presentation.unit ? ` ${presentation.unit}` : ""}</span>
                        <span className="rounded-lg bg-[color:var(--fl-bg)] px-3 py-1 text-sm font-bold text-[color:var(--fl-link)] shadow-sm">
                            {typeof value === "number" ? value : "—"}{typeof value === "number" && presentation.unit ? ` ${presentation.unit}` : ""}
                        </span>
                        <span className="text-[10px] font-semibold text-[color:var(--fl-text-4)]">{max}{presentation.unit ? ` ${presentation.unit}` : ""}</span>
                    </div>
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={presentation.step ?? 1}
                        value={current}
                        onChange={(event) => onChange(Number(event.target.value))}
                        className="w-full accent-[color:var(--fl-primary)]"
                    />
                </div>
            );
        }
        return <input type="number" aria-labelledby={`question-prompt-${q.id}`} value={value === undefined ? "" : String(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} style={inputStyle} />;
    }
    // text
    return <textarea aria-labelledby={`question-prompt-${q.id}`} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />;
}

function SingleChoiceInput({ q, value, onChange }: { q: Question; value: unknown; onChange: (v: unknown) => void }) {
    const compatible = q as Question & { allowOther?: boolean; otherLabel?: string };
    const options = q.options ?? [];
    const [otherSelected, setOtherSelected] = useState(
        compatible.allowOther === true && typeof value === "string" && value.length > 0 && !options.includes(value),
    );
    return (
        <div className="space-y-2.5">
            {options.length > 8 ? <div className="flu-question-many-options"><select aria-label={q.prompt} value={!otherSelected && typeof value === "string" ? value : ""} onChange={(event) => { setOtherSelected(false); onChange(event.target.value); }} style={inputStyle}><option value="" disabled>Elige una opción</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>{!otherSelected && typeof value === "string" && value ? <p>{value}</p> : null}</div> : null}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(options.length > 8 ? [] : options).map((opt) => (
                    <button key={opt} type="button" onClick={() => { setOtherSelected(false); onChange(opt); }}
                        style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${!otherSelected && value === opt ? "var(--fl-primary)" : "var(--fl-border)"}`, background: !otherSelected && value === opt ? "var(--fl-primary-subtle)" : "#fff", color: "var(--fl-text)" }}>
                        {opt}
                    </button>
                ))}
                {compatible.allowOther ? (
                    <button type="button" onClick={() => { setOtherSelected(true); onChange(""); }}
                        style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${otherSelected ? "var(--fl-primary)" : "var(--fl-border)"}`, background: otherSelected ? "var(--fl-primary-subtle)" : "#fff", color: "var(--fl-text)" }}>
                        {compatible.otherLabel ?? "Otro"}
                    </button>
                ) : null}
            </div>
            {otherSelected ? (
                <textarea
                    autoFocus
                    value={typeof value === "string" ? value : ""}
                    onChange={(event) => onChange(event.target.value)}
                    rows={2}
                    placeholder="Escribe otra respuesta"
                    style={{ ...inputStyle, resize: "vertical" }}
                />
            ) : null}
        </div>
    );
}
