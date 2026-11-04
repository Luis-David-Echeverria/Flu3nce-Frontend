import { useEffect, useState } from "react";

/** Identificadores reales del contrato, para reportar un turno sin copiar su contenido. */
export function ChatReference({ chatId, messageId, jobId, requestId }: { chatId: string; messageId?: string; jobId?: string; requestId?: string }) {
    const [copied, setCopied] = useState(false);
    const label = messageId ? "Mensaje" : "Chat";
    const reference = [`Chat: ${chatId}`, messageId ? `Mensaje: ${messageId}` : "", jobId ? `Trabajo: ${jobId}` : "", requestId ? `Solicitud: ${requestId}` : ""].filter(Boolean).join("\n");
    useEffect(() => setCopied(false), [chatId, messageId, jobId, requestId]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(reference);
            setCopied(true);
        } catch {
            setCopied(false);
        }
    };

    return <div className="flu-chat-reference" aria-label={`ID del ${label.toLocaleLowerCase("es-MX")}`}>
        <span>{label}:</span>
        <code title={messageId ?? chatId}>{messageId ?? chatId}</code>
        {requestId ? <><span>Solicitud:</span><code aria-label="ID de la solicitud">{requestId}</code></> : null}
        <button type="button" onClick={() => void copy()} aria-label={messageId ? "Copiar ID del chat y del mensaje" : "Copiar ID del chat"} title={messageId ? "Copiar referencia para reportar este mensaje" : "Copiar ID del chat"}>{copied ? "Copiado" : "Copiar ID"}</button>
    </div>;
}
