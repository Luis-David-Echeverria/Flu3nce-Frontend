import type { ChainBlock, ConsultationMessage } from "@/services/v2/types";

const kinds = new Set(["plan", "activity", "deliverable", "transition", "explanation"]);

export function readChainBlock(value: unknown): ChainBlock | undefined {
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if (typeof item.requestId !== "string" || typeof item.blockId !== "string" || typeof item.messageId !== "string" || typeof item.seq !== "number" || !Number.isInteger(item.seq) || item.seq < 1 || typeof item.final !== "boolean" || !kinds.has(String(item.kind))) return;
    return value as ChainBlock;
}

/** Blocks are immutable; message and chain.block may share an SSE id. */
export function mergeChainBlock(current: ChainBlock[], value: unknown): ChainBlock[] {
    const block = readChainBlock(value);
    if (!block || current.some((item) => item.requestId === block.requestId && (item.blockId === block.blockId || item.seq === block.seq))) return current;
    return [...current, block];
}

export function collectChainBlocks(messages: ConsultationMessage[], received: ChainBlock[] = []): ChainBlock[] {
    let result: ChainBlock[] = [];
    for (const message of messages) if (message.chainBlock?.messageId === message.id) result = mergeChainBlock(result, message.chainBlock);
    for (const block of received) result = mergeChainBlock(result, block);
    return result;
}
