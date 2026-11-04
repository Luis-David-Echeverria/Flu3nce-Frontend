import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const plugins = [remarkGfm];

/** Markdown de mensajes: sin HTML crudo ni carga automática de imágenes remotas. */
export const ChatMarkdown = memo(function ChatMarkdown({ text }: { text: string }) {
    return <div className="flu-markdown">
        <ReactMarkdown
            remarkPlugins={plugins}
            skipHtml
            components={{
                a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
                img: ({ alt }) => <span>{alt || "Imagen adjunta"}</span>,
            }}
        >{text}</ReactMarkdown>
    </div>;
});
