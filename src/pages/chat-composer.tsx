import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import type { ModelList } from "@/services/v2/models";

type Props = {
    id: string;
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onAttach: () => void;
    onOpenLibrary?: () => void;
    attachments?: File[];
    onRemoveAttachment?: (index: number) => void;
    disabled?: boolean;
    attachDisabled?: boolean;
    placeholder: string;
    label: string;
    submitLabel?: string;
    submitDisabled?: boolean;
    uploadControl?: () => void;
    stopControl?: { onStop: () => void; requested?: boolean };
    modelControls?: { catalog: ModelList; selected: string; onChange: (value: string) => void };
    modelStatus?: { state: "loading" | "unavailable" | "error"; onRetry: () => void };
    uploadProgress?: number | null;
};

function PaperclipIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m20.5 11.7-8.4 8.4a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.4-8.4" /></svg>;
}

function LibraryIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" /><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H19M8 7h7M8 10h7" /></svg>;
}

function SendIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 11.5 15-7-3 15-4.5-6-7.5-2Z" /><path d="m11.5 13.5 7.5-9" /></svg>;
}

function MicrophoneIcon() {
    return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 10.5a6.5 6.5 0 0 0 13 0M12 17v4m-4 0h8" /></svg>;
}

function attachmentNameParts(name: string) {
    const dot = name.lastIndexOf(".");
    const extension = dot > 0 ? name.slice(dot) : "";
    const stem = extension ? name.slice(0, dot) : name;
    if (stem.length <= 16) return { start: stem, end: extension };
    const tailLength = Math.min(8, Math.floor(stem.length / 2));
    return { start: stem.slice(0, -tailLength), end: `${stem.slice(-tailLength)}${extension}` };
}

export function ChatComposer({ id, value, onChange, onSubmit, onAttach, onOpenLibrary, attachments = [], onRemoveAttachment, disabled, submitDisabled, uploadControl, attachDisabled, placeholder, label, submitLabel = "Enviar mensaje", modelControls, modelStatus, uploadProgress = null, stopControl }: Props) {
    const textarea = useRef<HTMLTextAreaElement>(null);
    const draftRef = useRef(value);
    draftRef.current = value;
    const [dictationNotice, setDictationNotice] = useState<string | null>(null);
    const attachmentKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`;
    const { isListening, isSupported, error: dictationError, start, stop } = useSpeechRecognition({
        onResult: (transcript) => {
            const next = [draftRef.current.trim(), transcript.trim()].filter(Boolean).join(" ");
            draftRef.current = next;
            onChange(next);
            textarea.current?.focus();
        },
    });

    useEffect(() => { if (disabled && isListening) stop(); }, [disabled, isListening, stop]);

    useEffect(() => {
        const node = textarea.current;
        if (!node) return;
        node.style.height = "auto";
        node.style.height = `${Math.min(node.scrollHeight, 176)}px`;
    }, [value]);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        if (!disabled && !submitDisabled && (value.trim() || attachments.length)) { if (isListening) stop(); onSubmit(); }
    };
    const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            if (!disabled && !submitDisabled && (value.trim() || attachments.length)) { if (isListening) stop(); onSubmit(); }
        }
    };

    return <form onSubmit={handleSubmit} className={`flu-chat-composer ${stopControl ? "is-working" : ""}`}>
        {attachments.length ? <div className="flu-chat-attachment-tray" aria-label="Archivos pendientes de enviar">{attachments.map((file, index) => { const progress = uploadProgress; const name = attachmentNameParts(file.name); return <div key={attachmentKey(file)} className="flu-chat-attachment"><span aria-hidden="true">▤</span><span className="flu-chat-attachment-name" title={file.name}><span className="flu-chat-attachment-name-start">{name.start}</span><span className="flu-chat-attachment-name-end">{name.end}</span></span><small>{file.size < 1048576 ? `${Math.max(1, Math.round(file.size / 1024))} KB` : `${(file.size / 1048576).toFixed(1)} MB`}</small><span className="flu-chat-attachment-state">{progress === null ? "Pendiente" : progress >= 100 ? "Procesando" : `Subiendo ${progress}%`}</span><button type="button" onClick={() => onRemoveAttachment?.(index)} disabled={disabled} aria-label={`Quitar ${file.name}`} title={`Quitar ${file.name}`}>×</button>{progress !== null ? <div className="flu-chat-attachment-progress" role="progressbar" aria-label={`Carga de ${file.name}`} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div> : null}</div>; })}</div> : null}
        <label className="sr-only" htmlFor={id}>{label}</label>
        <textarea ref={textarea} id={id} value={value} onChange={(event) => { draftRef.current = event.target.value; onChange(event.target.value); }} onKeyDown={handleKeyDown} disabled={disabled} placeholder={placeholder} rows={2} className="flu-chat-composer-input" />
        <div className="flu-chat-composer-toolbar">
            <button type="button" onClick={onAttach} disabled={attachDisabled} className="flu-chat-composer-attach" aria-label="Adjuntar archivos" title="Adjuntar archivos"><PaperclipIcon /><span>Adjuntar</span></button>
            {onOpenLibrary ? <button type="button" onClick={onOpenLibrary} disabled={attachDisabled} className="flu-chat-composer-attach" aria-label="Adjuntar desde Flu3nce" title="Adjuntar desde la biblioteca del proyecto"><LibraryIcon /><span>Desde Flu3nce</span></button> : null}
            {modelControls ? <select className="flu-chat-composer-model" aria-label="Modelo de Flu3nce" value={modelControls.selected} onChange={(event) => modelControls.onChange(event.target.value)}>{modelControls.catalog.models.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select> : null}
            {!modelControls && modelStatus ? <span className="flu-chat-composer-model-status"><span>{modelStatus.state === "loading" ? "Consultando…" : "No disponible"}</span>{modelStatus.state !== "loading" ? <button type="button" onClick={modelStatus.onRetry} aria-label="Reintentar consulta de modelos" title="Reintentar consulta de modelos">↻</button> : null}</span> : null}
            <span className="flu-chat-composer-hint">Enter para enviar · Shift + Enter para nueva línea</span>
            <button type="button" onClick={() => { setDictationNotice(null); if (!isSupported) { setDictationNotice("El dictado no está disponible en este navegador."); return; } if (isListening) stop(); else void start(); }} disabled={disabled} className={`flu-chat-composer-dictate ${isListening ? "is-listening" : ""}`} aria-label={isListening ? "Detener dictado" : "Iniciar dictado"} aria-pressed={isListening} title={isListening ? "Detener dictado" : "Dictar mensaje"}><MicrophoneIcon /></button>
            {uploadControl || stopControl ? <button type="button" onClick={uploadControl ?? stopControl?.onStop} disabled={stopControl?.requested} className="flu-chat-composer-send is-task-control" aria-label={uploadControl ? "Cancelar envío de archivos" : stopControl?.requested ? "Deteniendo Flu3nce" : "Detener Flu3nce"} title={uploadControl ? "Cancelar envío de archivos" : "Detener Flu3nce"}><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg></button> : <button type="submit" disabled={disabled || submitDisabled || (!value.trim() && !attachments.length)} className="flu-chat-composer-send" aria-label={submitLabel} title={submitLabel}><SendIcon /></button>}
        </div>
        {isListening ? <p role="status" className="flu-chat-composer-notice">Escuchando… pulsa el micrófono para detener.</p> : dictationError || dictationNotice ? <p role="status" className="flu-chat-composer-notice">{dictationError ?? dictationNotice}</p> : null}
    </form>;
}
