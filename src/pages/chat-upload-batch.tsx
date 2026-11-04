import { useState } from "react";
import { type PendingUploadBatch, type UploadBatchManager } from "@/hooks/upload-batch-manager";

export function fileSizeLabel(bytes: number) {
    if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ChatUploadBatch({ record, manager }: { record: PendingUploadBatch; manager: UploadBatchManager }) {
    const [selectionError, setSelectionError] = useState<string>();
    const state = record.batch?.state;
    const finished = state === "sent" || state === "cancelled" || state === "expired";
    const status = record.cancelRequested ? "Cancelando envío…" : state === "cancelled" ? "Envío cancelado" : state === "expired" ? "El envío caducó" : state === "sent" || state === "sending" || state === "ready" ? "Flu3nce está preparando la respuesta…" : "Preparando archivos para tu mensaje";
    return <section className="flu-upload-batch" aria-label="Solicitud con archivos en preparación">
        <div className="flu-upload-heading"><p role="status">{status}</p>{finished && state !== "sent" ? <button type="button" onClick={() => manager.dismiss(record.id)}>Cerrar</button> : null}</div>
        <ul className="flu-upload-files">{record.files.map((file, index) => {
            const upload = record.batch?.files[index];
            const transfer = upload ? record.transfers[upload.uploadId] : undefined;
            const receivedBytes = upload?.received.reduce((sum, n) => sum + Math.min(upload.partSize, Math.max(0, file.size - (n - 1) * upload.partSize)), 0) ?? 0;
            const percentage = file.size ? Math.min(100, Math.round(Math.max(receivedBytes, transfer?.loaded ?? 0) / file.size * 100)) : 100;
            const cancelling = file.cancelled && upload?.state !== "cancelled";
            const label = upload?.state === "cancelled" || state === "cancelled" ? "Cancelado" : cancelling ? "Cancelando…" : upload?.state === "failed" ? "No se pudo leer" : upload?.state === "ready" ? "Listo" : transfer?.error ? "Subida interrumpida" : transfer?.needsFile ? "Selecciona el archivo para reanudar" : upload?.state === "verifying" ? "Verificando archivo…" : upload?.state === "registered" ? "Preparando lectura…" : upload?.state === "reading" ? upload.stage === "transcribing" ? "Transcribiendo audio…" : upload.stage === "ocr" ? upload.progress?.total ? `Reconociendo texto · página ${upload.progress.done ?? 0} de ${upload.progress.total}` : "Reconociendo texto…" : "Leyendo documento…" : upload ? `Subiendo ${percentage}%` : "Preparando subida…";
            const canCancel = !finished && !record.cancelRequested && upload?.state !== "cancelled";
            return <li key={index} className={`flu-upload-file ${upload?.state === "ready" ? "is-ready" : ""} ${upload?.state === "failed" || transfer?.error ? "is-failed" : ""}`}>
                <div className="flu-upload-file-name"><span aria-hidden="true">▤</span><strong title={file.name}>{file.name.length > 22 ? <><span>{file.name.slice(0, -12)}</span><span>{file.name.slice(-12)}</span></> : file.name}</strong><small>{fileSizeLabel(file.size)}</small></div>
                <div className="flu-upload-file-status"><span>{label}</span><div>
                    {!finished && !file.cancelled && (transfer?.needsFile || transfer?.error) ? transfer.needsFile ? <label className="flu-upload-reselect">Seleccionar archivo<input type="file" aria-label={`Seleccionar de nuevo ${file.name}`} onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; if (selected) { setSelectionError(undefined); void manager.retry(record.id, index, selected).catch((error: Error) => setSelectionError(error.message)); } }} /></label> : <button type="button" onClick={() => void manager.retry(record.id, index)}>Reanudar</button> : null}
                    {canCancel ? <button type="button" onClick={() => void manager.cancelFile(record.id, index)} aria-label={`Cancelar subida de ${file.name}`} title={cancelling ? "Reintentar cancelación" : "Quitar archivo"}>×</button> : null}
                </div></div>
                {upload?.state === "uploading" && !file.cancelled && !finished ? <div className="flu-upload-progress" role="progressbar" aria-label={`Subida de ${file.name}`} aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${percentage}%` }} /></div> : null}
                {upload && ["verifying", "registered", "reading"].includes(upload.state) && !file.cancelled && !finished ? <div className="flu-upload-progress is-indeterminate" role="progressbar" aria-label={`Preparación de ${file.name}`} aria-valuetext={label}><span /></div> : null}
                {transfer?.error ? <p className="flu-upload-error">{transfer.error}</p> : null}
                {upload?.state === "failed" ? <p className="flu-upload-error">{upload.error?.code === "source_text_empty" ? "No se encontró texto legible en este archivo." : "El servidor no pudo preparar este archivo. Flu3nce recibirá los demás archivos disponibles."}</p> : null}
            </li>;
        })}</ul>
        {record.error ? <p role="alert" className="flu-upload-error">{record.error} <button type="button" onClick={() => void manager.retry(record.id)}>{record.cancelRequested ? "Reintentar cancelación" : "Reintentar"}</button></p> : null}
        {selectionError ? <p role="alert" className="flu-upload-error">{selectionError}</p> : null}
        {record.files.some((file, index) => !file.cancelled && record.batch?.files[index]?.state === "uploading") && !finished ? <p className="flu-upload-help">Puedes seguir en otro chat mientras suben. Si cierras la página, selecciona los mismos archivos al volver para continuar desde las partes recibidas.</p> : null}
    </section>;
}
