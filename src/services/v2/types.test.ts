import { describe, expect, it } from "vitest";

import { deliverableIdFromJob, ignoredOptionsFromPackageResult, isDeliverableResult, isPackageResult } from "./types";
import { makeJob, makePackageResult } from "@/test/fixtures";

describe("discriminantes de resultados v2", () => {
    it("distingue paquetes completos y parciales", () => {
        expect(isPackageResult(makePackageResult())).toBe(true);
        expect(isPackageResult(makePackageResult({ resultKind: "package_partial" }))).toBe(true);
        expect(isPackageResult(undefined)).toBe(false);
    });

    it("distingue un resultado de entregable", () => {
        const result = {
            resultKind: "presentation_generated",
            ok: true,
            outputFile: "presentacion.pptx",
            gammaUrl: "",
            generationId: "generation_1",
            deliverableId: "deliverable_1",
            cardsGenerated: 12,
            creditsUsed: null,
            overwroteManualEdit: null,
            overwrittenVersion: null,
            fieldsNotEmitted: [],
            contributionsUsed: null,
        } satisfies import("./types").PresentationResult;
        expect(isDeliverableResult(result)).toBe(true);
        expect(isDeliverableResult(makePackageResult())).toBe(false);
    });

    it("expone las opciones ignoradas por separado", () => {
        const result = makePackageResult({
            optionsIgnored: [{ option: "numCards", reason: "Debe estar entre 1 y 60" }],
        });
        expect(ignoredOptionsFromPackageResult(result)).toEqual([
            { option: "numCards", reason: "Debe estar entre 1 y 60" },
        ]);
        expect(ignoredOptionsFromPackageResult(undefined)).toEqual([]);
    });

    it("prefiere el entregable del resultado y conserva el fallback del job", () => {
        const withResult = makeJob({
            status: "done",
            deliverableId: "legacy_id",
            result: {
                resultKind: "presentation_generated",
                ok: true,
                outputFile: "presentacion.pptx",
                gammaUrl: "",
                generationId: "generation_1",
                deliverableId: "result_id",
                cardsGenerated: 12,
                creditsUsed: null,
                overwroteManualEdit: null,
                overwrittenVersion: null,
                fieldsNotEmitted: [],
                contributionsUsed: null,
            },
        });
        expect(deliverableIdFromJob(withResult)).toBe("result_id");
        expect(deliverableIdFromJob(makeJob({ deliverableId: "legacy_id" }))).toBe("legacy_id");
    });
});
