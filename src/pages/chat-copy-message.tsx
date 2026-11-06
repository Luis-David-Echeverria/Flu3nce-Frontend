import { useEffect, useState } from "react";
import { Check, Copy01 } from "@untitledui/icons";
import { toMarkdownTable } from "@/lib/table-export";
import type { ConsultationMessage } from "@/services/v2/types";

/** El texto que se copia de una respuesta: su texto y sus tablas, en Markdown. */
export function messageCopyText(item: ConsultationMessage, displayText: string, explanation?: string): string {
    const parts = item.parts?.filter((part) => part.kind !== "activity_group") ?? [];
    const body = parts.length
        ? parts.map((part) => {
            if (part.kind === "text") return part.text ?? "";
            if (part.kind === "table" && part.table) return toMarkdownTable(part.table.columns, part.table.rows.map((row) => row.map((cell) => String(cell ?? ""))));
            if (part.kind === "question") return part.clarification?.prompt ?? "";
            return "";
        }).filter((text) => text.trim()).join("\n\n")
        : displayText;
    return [body, explanation && explanation !== displayText ? explanation : ""].filter((text) => text.trim()).join("\n\n").trim();
}

/** Copiar una respuesta de Flu3nce, como en cualquier chat. */
export function ChatCopyMessage({ text }: { text: string }) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

    useEffect(() => {
        if (state === "idle") return;
        const timer = window.setTimeout(() => setState("idle"), 2000);
        return () => window.clearTimeout(timer);
    }, [state]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setState("copied");
        } catch {
            setState("failed");
        }
    };

    return <div className="flu-message-actions">
        <button type="button" onClick={() => void copy()} aria-label="Copiar respuesta" title="Copiar respuesta">
            {state === "copied" ? <Check aria-hidden="true" /> : <Copy01 aria-hidden="true" />}
            <span aria-hidden="true">{state === "copied" ? "Copiado" : "Copiar"}</span>
        </button>
        <span role="status" className="sr-only">{state === "copied" ? "Respuesta copiada" : state === "failed" ? "No se pudo copiar la respuesta" : ""}</span>
        {state === "failed" ? <span className="flu-message-actions-note">No se pudo copiar. Selecciona el texto y cópialo a mano.</span> : null}
    </div>;
}
