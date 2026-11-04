import { describe, expect, it } from "vitest";

import type { Job } from "@/services/v2/types";

import {
    mockAnswerJob,
    mockCancelJob,
    mockCreateProject,
    mockCreateUnit,
    mockGenerateUnit,
    mockGetDeliverableContent,
    mockGetJob,
    mockGetUnit,
    mockListDeliverables,
    mockUploadSource,
} from "./api-store";

const createProcess = (name: string) => {
    const project = mockCreateProject(`Integración ${name}`);
    const unit = mockCreateUnit(project.id, { kind: "process", name: `Proceso ${name}` });
    return { project, unit };
};

const addSource = (projectId: string) =>
    mockUploadSource(projectId, new File(["Contexto suficiente para generar el proceso."], "contexto.txt", { type: "text/plain" }));

const advance = (jobId: string, polls = 3): Job => {
    let job = mockGetJob(jobId);
    for (let index = 1; index < polls; index += 1) job = mockGetJob(jobId);
    return job;
};

describe("flujo integrado del paquete de una unidad", () => {
    it("solicita archivos cuando el proyecto no tiene fuentes y continúa con sourceId", () => {
        const { project, unit } = createProcess("con pregunta");
        const { jobId } = mockGenerateUnit(project.id, unit.id);

        const waiting = mockGetJob(jobId);
        expect(waiting.status).toBe("needs_input");
        expect(waiting.questions).toEqual([
            expect.objectContaining({
                id: "package_sources",
                kind: "files",
                allowedExtensions: expect.arrayContaining(["pdf", "docx", "mp3", "mp4"]),
            }),
        ]);

        const source = addSource(project.id);
        mockAnswerJob(jobId, [{ questionId: "package_sources", value: [source.id] }]);

        const finished = advance(jobId);
        expect(finished.status).toBe("done");
        expect(finished.result).toEqual(expect.objectContaining({
            resultKind: "package_generated",
            deliverablesGenerated: 3,
            deliverablesExpected: 3,
        }));
        expect(finished.children).toHaveLength(3);
        expect(finished.children?.every((child) => child.status === "done" && child.deliverableId)).toBe(true);
        expect(mockListDeliverables(project.id, { unitId: unit.id })).toHaveLength(3);
        expect(mockGetUnit(project.id, unit.id).status).toBe("ready");
    });

    it("es idempotente mientras existe un paquete activo", () => {
        const { project, unit } = createProcess("idempotente");
        const source = addSource(project.id);

        const first = mockGenerateUnit(project.id, unit.id, { from: [source.id] });
        const second = mockGenerateUnit(project.id, unit.id, { from: [source.id] });

        expect(second.jobId).toBe(first.jobId);
    });

    it("conserva los resultados útiles cuando un hijo falla", () => {
        const { project, unit } = createProcess("parcial");
        const source = addSource(project.id);
        const { jobId } = mockGenerateUnit(project.id, unit.id, {
            from: [source.id],
            options: { mockFailType: "diagram_as_is" },
        });

        const finished = advance(jobId);
        expect(finished.status).toBe("done");
        expect(finished.result).toEqual(expect.objectContaining({
            resultKind: "package_partial",
            deliverablesGenerated: 2,
            deliverablesExpected: 3,
        }));
        expect(finished.children?.find((child) => child.deliverableType === "diagram_as_is")).toEqual(
            expect.objectContaining({ status: "failed", error: expect.objectContaining({ code: "mock_generation_failed" }) }),
        );
        expect(mockListDeliverables(project.id, { unitId: unit.id })).toHaveLength(2);
        expect(mockGetUnit(project.id, unit.id).status).toBe("active");
    });

    it("al reintentar reutiliza lo exitoso y genera únicamente lo pendiente", () => {
        const { project, unit } = createProcess("reintento selectivo");
        const source = addSource(project.id);
        const first = mockGenerateUnit(project.id, unit.id, {
            from: [source.id],
            options: { mockFailType: "diagram_as_is" },
        });
        const partial = advance(first.jobId);
        expect(partial.result).toEqual(expect.objectContaining({ resultKind: "package_partial" }));

        const before = mockListDeliverables(project.id, { unitId: unit.id });
        const retained = new Map(before.map((deliverable) => [deliverable.type, {
            id: deliverable.id,
            version: deliverable.currentVersion,
        }]));

        const retry = mockGenerateUnit(project.id, unit.id, { from: [source.id] });
        const finished = advance(retry.jobId, 1);
        const after = mockListDeliverables(project.id, { unitId: unit.id });

        expect(finished.result).toEqual(expect.objectContaining({ resultKind: "package_generated" }));
        expect(finished.children?.filter((child) => child.reused)).toHaveLength(2);
        expect(finished.children?.find((child) => child.deliverableType === "diagram_as_is")?.reused).not.toBe(true);
        expect(after).toHaveLength(3);
        for (const deliverable of after.filter((item) => item.type !== "diagram_as_is")) {
            expect({ id: deliverable.id, version: deliverable.currentVersion }).toEqual(retained.get(deliverable.type));
        }
    });

    it("propaga la cancelación del padre a todos los hijos vivos", () => {
        const { project, unit } = createProcess("cancelado");
        const source = addSource(project.id);
        const { jobId } = mockGenerateUnit(project.id, unit.id, { from: [source.id] });

        mockCancelJob(jobId);

        const cancelled = mockGetJob(jobId);
        expect(cancelled.status).toBe("cancelled");
        expect(cancelled.children?.every((child) => child.status === "cancelled")).toBe(true);
        expect(mockListDeliverables(project.id, { unitId: unit.id })).toHaveLength(0);
    });

    it("rechaza referencias a fuentes de otro proyecto", () => {
        const target = createProcess("fuente inválida");
        const foreign = createProcess("fuente ajena");
        const foreignSource = addSource(foreign.project.id);
        const { jobId } = mockGenerateUnit(target.project.id, target.unit.id);

        expect(() => mockAnswerJob(jobId, [{ questionId: "package_sources", value: [foreignSource.id] }])).toThrow(
            "Una de las fuentes no pertenece a este proyecto.",
        );
    });
});

describe("representaciones JSON definitivas", () => {
    it.each([
        ["diagram_as_is", "contrato-a"],
        ["transcription", "transcription-v1"],
        ["understanding", "understanding-v1"],
        ["diagnostic", "diagnostic-v1"],
        ["policy_analysis", "policy-analysis-v1"],
        ["policy_draft", "policy-draft-v1"],
    ] as const)("expone %s con su discriminante", (type, schemaVersion) => {
        expect(mockGetDeliverableContent(type)).toEqual(expect.objectContaining({ schemaVersion }));
    });

    it("mantiene editables únicamente diagrama y transcripción", () => {
        expect(mockGetDeliverableContent("diagram_as_is")).toEqual(expect.objectContaining({ nodes: expect.any(Array), edges: expect.any(Array) }));
        expect(mockGetDeliverableContent("transcription")).toEqual(expect.objectContaining({ segments: expect.any(Array) }));
    });
});
