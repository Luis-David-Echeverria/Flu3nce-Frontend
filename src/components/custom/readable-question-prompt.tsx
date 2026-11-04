import { ChatMarkdown } from "./chat-markdown";

/** Separa la lista de fuentes y los pasos que el backend envía en una sola pregunta. */
export function ReadableQuestionPrompt({ prompt }: { prompt: string }) {
    const text = prompt.trim().replace(/^\*\*([\s\S]+)\*\*$/, "$1");
    const marker = " identificamos estos pasos, citados tal como aparecen:";
    const markerAt = text.indexOf(marker);
    const conclusionAt = text.lastIndexOf(" No está claro");
    if (markerAt < 0 || conclusionAt < markerAt) return <ChatMarkdown text={prompt} />;

    const files = Array.from(text.slice(0, markerAt).replace(/^En\s+/i, "").matchAll(/(?:^|,\s*)([^,]+?\.(?:pdf|docx|xlsx|pptx|md|txt))(?=,|$)/gi), (match) => match[1].trim());
    const steps = Array.from(text.slice(markerAt + marker.length, conclusionAt).matchAll(/(?:^|\s)(\d+)\.\s+(.+?)(?=\s+\d+\.\s+|$)/gs), (match) => match[2].trim());
    if (files.length < 2 || steps.length < 2) return <ChatMarkdown text={prompt} />;

    return <div className="flu-question-readable">
        <details><summary>{files.length} archivos citados</summary><ul>{files.map((file, index) => <li key={`${file}-${index}`}>{file}</li>)}</ul></details>
        <p>Pasos citados tal como aparecen:</p>
        <ol>{steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
        <p>{text.slice(conclusionAt).trim()}</p>
    </div>;
}
