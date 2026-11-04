import { describe, expect, it, vi } from "vitest";

import { ApiServiceError, apiError, fetchError, manualVersionConflicts } from "./http";
import { markSessionActive, SESSION_EXPIRED_EVENT } from "@/lib/session-expiry";

describe("errores HTTP v2", () => {
    it("usa el mensaje público del contrato", () => {
        expect(apiError({ code: "project_not_found", message: "No existe el proyecto." }, "Fallback").message)
            .toBe("No existe el proyecto.");
    });

    it("usa un fallback ante cuerpos vacíos o no declarados", () => {
        expect(apiError(undefined, "No se pudo completar").message).toBe("No se pudo completar");
        expect(apiError({ message: 123 }, "No se pudo completar").message).toBe("No se pudo completar");
    });

    it("lee errores JSON de cargas y descargas", async () => {
        const response = new Response(JSON.stringify({ code: "source_unreadable", message: "No pudimos leer el archivo." }), {
            status: 422,
            headers: { "content-type": "application/json" },
        });
        await expect(fetchError(response, "Fallback")).resolves.toEqual(
            new ApiServiceError("No pudimos leer el archivo.", "source_unreadable"),
        );
    });

    it("también cierra la sesión ante un 401 de una subida o descarga binaria", async () => {
        markSessionActive();
        const listener = vi.fn();
        window.addEventListener(SESSION_EXPIRED_EVENT, listener);
        try {
            const response = new Response(JSON.stringify({ code: "unauthorized", message: "Sesión caducada" }), { status: 401 });
            await fetchError(response, "No se pudo descargar");
            expect(listener).toHaveBeenCalledOnce();
        } finally {
            window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
        }
    });

    it("no filtra cuerpos no JSON", async () => {
        const response = new Response("upstream trace abc", { status: 500 });
        await expect(fetchError(response, "No se pudo completar")).resolves.toEqual(new Error("No se pudo completar"));
    });

    it("conserva los datos necesarios para confirmar una versión manual", () => {
        const error = apiError({
            code: "manual_version_conflict",
            message: "Hay una edición manual vigente.",
            detail: { conflicts: [{ deliverableId: "diagram_1", deliverableType: "diagram_as_is", version: 2 }] },
        }, "Fallback");
        expect(manualVersionConflicts(error)).toEqual([{ deliverableId: "diagram_1", deliverableType: "diagram_as_is", version: 2 }]);
    });
});
