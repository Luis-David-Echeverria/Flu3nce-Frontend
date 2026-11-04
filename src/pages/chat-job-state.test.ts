import { describe, expect, it } from "vitest";
import { activityFromJob, cancelReasonLabel, jobStatusLabel } from "./chat-job-state";

describe("esperas y señal de vida del job", () => {
    it("no espera latidos periódicos de un trabajo pausado ni de uno en cola", () => {
        expect(activityFromJob({ id: "j1", status: "paused", lastHeartbeatAt: "2026-01-01T00:00:00Z" })).toMatchObject({ state: "paused", expectHeartbeat: false });
        expect(activityFromJob({ id: "j1", status: "queued", queuePosition: 3 })).toMatchObject({ label: "En cola · posición 3", expectHeartbeat: false });
    });
    it("explica la dependencia en palabras y no expone códigos internos desconocidos", () => {
        expect(jobStatusLabel({ id: "j1", status: "esperando", waitingFor: { kind: "source", name: "Entrevista.mp3" } })).toBe("Esperando la lectura de Entrevista.mp3");
        expect(jobStatusLabel({ id: "j1", status: "running", stage: "private_stage_7" })).toBe("Trabajo en curso");
        expect(cancelReasonLabel("future_reason")).toBe("El trabajo se detuvo");
    });
    it("no inventa una duración de etapa a partir de la hora del latido", () => {
        const first = activityFromJob({ id: "j1", status: "running", createdAt: "2026-01-01T00:00:00Z", lastHeartbeatAt: "2026-01-01T00:05:00Z" });
        const next = activityFromJob({ id: "j1", status: "running", createdAt: "2026-01-01T00:00:00Z", lastHeartbeatAt: "2026-01-01T00:05:15Z" });
        expect(first.durationUnknown).toBe(true);
        expect(next.durationUnknown).toBe(true);
        expect(next.updatedAt).toBeGreaterThan(first.updatedAt);
    });
});
