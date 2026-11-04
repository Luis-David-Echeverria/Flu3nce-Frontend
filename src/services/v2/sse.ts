export type SseEvent = { event: string; data: Record<string, unknown>; id?: string };

/** Bounded stream reader shared by turn and background events. Comments are heartbeats. */
export async function readSse(response: Response, onEvent: (event: SseEvent) => void | boolean, options: { signal?: AbortSignal; onHeartbeat?: () => void; idleMs?: number } = {}) {
    if (!response.body) throw new Error("La respuesta no permite leer el stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", lastData = Date.now(), timedOut = false, stopped = false;
    const abort = () => { void reader.cancel().catch(() => undefined); };
    options.signal?.addEventListener("abort", abort, { once: true });
    const timer = setInterval(() => { if (Date.now() - lastData > (options.idleMs ?? 45000)) { timedOut = true; abort(); } }, 5000);
    const consume = (frame: string) => {
        let event = "message", id: string | undefined;
        const data: string[] = [];
        for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("id:")) id = line.slice(3).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
        }
        if (data.length && onEvent({ event, data: JSON.parse(data.join("\n")), ...(id ? { id } : {}) }) === false) stopped = true;
    };
    try {
        while (!stopped) {
            if (options.signal?.aborted) throw new DOMException("Cancelado", "AbortError");
            const { value, done } = await reader.read();
            if (value?.length) { lastData = Date.now(); options.onHeartbeat?.(); }
            buffer += decoder.decode(value, { stream: !done });
            buffer = buffer.replace(/\r\n/g, "\n");
            let boundary = buffer.indexOf("\n\n");
            while (boundary >= 0 && !stopped) { consume(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); boundary = buffer.indexOf("\n\n"); }
            if (done) { if (!stopped && buffer.trim()) consume(buffer); break; }
        }
        if (options.signal?.aborted) throw new DOMException("Cancelado", "AbortError");
        if (timedOut) throw new Error("Se perdió la señal de la conexión");
    } finally {
        clearInterval(timer);
        options.signal?.removeEventListener("abort", abort);
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
