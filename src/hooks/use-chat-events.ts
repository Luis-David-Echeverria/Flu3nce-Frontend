import { useEffect, useRef, useState } from "react";
import { watchChatEvents, type ChatStreamEvent } from "@/services/v2/chats";
import type { ChainBlock, ConsultationMessage } from "@/services/v2/types";
import { reduceActivity, type LiveActivity } from "@/pages/chat-stream-state";
import { mergeChainBlock } from "@/pages/chat-chain-state";

export function useChatEvents(chatId: string, after: string | undefined, enabled: boolean, onMessage: (message: ConsultationMessage) => void) {
    const [activities, setActivities] = useState<LiveActivity[]>([]);
    const [connection, setConnection] = useState("connecting");
    const [explanations, setExplanations] = useState<Record<string, string>>({});
    const [chainBlocks, setChainBlocks] = useState<ChainBlock[]>([]);
    const callback = useRef(onMessage), initialCursor = useRef(after);
    callback.current = onMessage; initialCursor.current = after;
    useEffect(() => {
        setActivities([]); setExplanations({}); setChainBlocks([]);
        if (!enabled || !chatId) { setConnection("unavailable"); return; }
        const controller = new AbortController();
        let cursor = initialCursor.current, stopped = false, attempts = 0;
        const onEvent = (event: ChatStreamEvent) => {
            if (stopped) return;
            if (event.id) cursor = event.id;
            if (event.event === "message" && typeof event.data.id === "string") {
                const message = event.data as ConsultationMessage;
                if (message.chainBlock) setChainBlocks((current) => mergeChainBlock(current, message.chainBlock));
                callback.current(message);
            }
            if (event.event === "chain.block") setChainBlocks((current) => mergeChainBlock(current, event.data));
            if (event.event.startsWith("activity.")) setActivities((items) => reduceActivity(items, event));
            if (event.event === "deliverable.card" && typeof event.data.messageId === "string" && typeof event.data.explanation === "string") setExplanations((items) => ({ ...items, [String(event.data.messageId)]: String(event.data.explanation) }));
        };
        const connect = async () => {
            while (!stopped) {
                setConnection(attempts ? "reconnecting" : "connecting");
                try {
                    const available = await watchChatEvents(chatId, cursor, onEvent, controller.signal, () => { if (!stopped) { setConnection("live"); attempts = 0; } });
                    if (!available) { if (!stopped) setConnection("unavailable"); return; }
                } catch { if (stopped || controller.signal.aborted) return; }
                if (stopped) return;
                setConnection("reconnecting"); attempts++;
                await new Promise<void>((resolve) => {
                    const finish = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
                    const timer = setTimeout(finish, Math.min(10000, 1000 * attempts));
                    controller.signal.addEventListener("abort", finish, { once: true });
                });
            }
        };
        void connect();
        return () => { stopped = true; controller.abort(); };
    }, [chatId, enabled]);
    return { activities, connection, explanations, chainBlocks };
}
