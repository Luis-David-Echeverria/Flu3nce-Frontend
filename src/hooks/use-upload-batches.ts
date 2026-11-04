import { useEffect, useMemo, useSyncExternalStore } from "react";
import { UploadBatchManager } from "./upload-batch-manager";

export function useUploadBatches(userId: string, enabled = true) {
    const manager = useMemo(() => {
        let storage: Storage | undefined;
        try { storage = window.localStorage; } catch { /* Private browser mode may disable storage. */ }
        return new UploadBatchManager(`fluence:upload-batches:${userId}`, storage);
    }, [userId]);
    const batches = useSyncExternalStore(manager.subscribe, manager.getSnapshot);
    useEffect(() => { if (enabled) manager.connect(); return manager.disconnect; }, [manager, enabled]);
    return { batches, manager };
}
