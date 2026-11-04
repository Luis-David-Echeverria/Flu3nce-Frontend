import { RESULT_DEMOS, transcriptionContent as initialTranscriptionContent } from "@/mocks/deliverable-results";
import {
    diagnosticContent,
    policyAnalysisContent,
    policyDraftContent,
    understandingContent,
} from "@/mocks/deliverable-contents";
import type {
    ContractA,
    Deliverable,
    DeliverableType,
    DeliverableJsonContent,
    Job,
    JobResult,
    Member,
    Project,
    Role,
    Source,
    TranscriptionContent,
    Unit,
    UnitKind,
    User,
    VersionList,
} from "@/services/v2/types";

const PROJECT_ID = "prj_mock_reclutamiento";
const CREATED_AT = "2026-08-14T15:30:00Z";
const UPDATED_AT = "2026-09-10T16:20:00Z";

const resultType: Record<(typeof RESULT_DEMOS)[number]["key"], DeliverableType> = {
    diagnostic: "diagnostic",
    diagram: "diagram_as_is",
    understanding: "understanding",
    presentation: "presentation",
    translation: "translation",
    policy: "policy_analysis",
    "policy-draft": "policy_draft",
    transcription: "transcription",
};

const unitByType: Partial<Record<DeliverableType, string>> = {
    diagnostic: "unit_mock_process",
    diagram_as_is: "unit_mock_process",
    understanding: "unit_mock_process",
    policy_analysis: "unit_mock_policy",
    policy_draft: "unit_mock_policy",
    presentation: "unit_mock_presentation",
    translation: "unit_mock_document",
    transcription: "unit_mock_document",
};

const PACKAGE_BY_KIND: Partial<Record<UnitKind, DeliverableType[]>> = {
    process: ["understanding", "diagram_as_is", "diagnostic"],
    policy: ["policy_analysis", "policy_draft"],
    presentation: ["presentation"],
};

let projects: Project[] = [
    {
        id: PROJECT_ID,
        name: "Reclutamiento y selección de personal",
        description: "Proyecto demostrativo para pulir la experiencia de entregables V2.",
        status: "active",
        role: "owner",
        createdBy: "usr_mock_david",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
];

let units: Unit[] = [
    {
        id: "unit_mock_process",
        projectId: PROJECT_ID,
        kind: "process",
        name: "Proceso de reclutamiento",
        status: "ready",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "unit_mock_policy",
        projectId: PROJECT_ID,
        kind: "policy",
        name: "Políticas de contratación",
        status: "ready",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "unit_mock_presentation",
        projectId: PROJECT_ID,
        kind: "presentation",
        name: "Presentación ejecutiva",
        status: "ready",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "unit_mock_document",
        projectId: PROJECT_ID,
        kind: "document",
        name: "Sesión de levantamiento",
        status: "ready",
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
];

let sources: Source[] = [
    {
        id: "src_mock_acta",
        projectId: PROJECT_ID,
        name: "Acta_sesion_levantamiento.docx",
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 184320,
        kind: "document",
        status: "ready",
        currentVersion: 2,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "src_mock_manual",
        projectId: PROJECT_ID,
        name: "Manual_de_Reclutamiento_v3.pdf",
        mime: "application/pdf",
        size: 2310000,
        kind: "document",
        status: "ready",
        currentVersion: 3,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "src_mock_audio",
        projectId: PROJECT_ID,
        name: "Sesion_levantamiento_RH.mp3",
        mime: "audio/mpeg",
        size: 18420000,
        kind: "audio",
        status: "ready",
        currentVersion: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
    {
        id: "src_mock_policy",
        projectId: PROJECT_ID,
        name: "Politica_de_Contratacion.pdf",
        mime: "application/pdf",
        size: 842000,
        kind: "document",
        status: "ready",
        currentVersion: 1,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    },
];

const resultByType = Object.fromEntries(RESULT_DEMOS.map((demo) => [resultType[demo.key], demo.result])) as Partial<Record<DeliverableType, JobResult>>;

const resultForDeliverable = (type: DeliverableType, deliverableId: string): JobResult | undefined => {
    const result = resultByType[type];
    return result ? ({ ...structuredClone(result), deliverableId } as JobResult) : undefined;
};

let deliverables: Deliverable[] = RESULT_DEMOS.map((demo, index) => {
    const type = resultType[demo.key];
    return {
        id: `dlv_mock_${type}`,
        projectId: PROJECT_ID,
        unitId: unitByType[type] ?? "unit_mock_process",
        type,
        status: "ready",
        currentVersion: (index % 3) + 1,
        from: [sources[index % sources.length].id],
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
    };
});

let jobs: Job[] = deliverables.map((deliverable) => ({
    id: `job_mock_${deliverable.type}`,
    type: `deliverable:${deliverable.type}`,
    projectId: PROJECT_ID,
    deliverableId: deliverable.id,
    status: "done",
    progress: 1,
    result: resultForDeliverable(deliverable.type, deliverable.id),
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
}));

const packageUnitByJob = new Map<string, string>();
const packageRequestByJob = new Map<string, { from?: string[] | null; options?: Record<string, unknown> | null }>();

let transcriptionContent: TranscriptionContent = structuredClone(initialTranscriptionContent);
let diagramContent: ContractA = {
    schemaVersion: "contrato-a",
    version: "2.0.0",
    process: {
        id: "process_reclutamiento",
        name: "Reclutamiento y selección de personal",
        description: "Flujo actual levantado con el equipo de Recursos Humanos.",
    },
    lanes: [
        { id: "lane_gerencia", name: "Gerencia solicitante", order: 0 },
        { id: "lane_rh", name: "Recursos Humanos", order: 1 },
        { id: "lane_candidato", name: "Candidato", order: 2 },
        { id: "lane_nomina", name: "Nómina", order: 3 },
    ],
    nodes: [
        { id: "start_solicitud", type: "startEvent", name: "Vacante identificada", lane: "lane_gerencia" },
        { id: "task_requisicion", type: "userTask", name: "Preparar requisición", lane: "lane_gerencia" },
        { id: "task_revision", type: "userTask", name: "Revisar perfil y presupuesto", lane: "lane_rh" },
        { id: "gateway_completa", type: "exclusiveGateway", name: "¿Solicitud completa?", lane: "lane_rh" },
        { id: "task_publicar", type: "userTask", name: "Publicar vacante", lane: "lane_rh" },
        { id: "task_postular", type: "userTask", name: "Enviar postulación", lane: "lane_candidato" },
        { id: "task_entrevista", type: "userTask", name: "Realizar entrevistas", lane: "lane_rh" },
        { id: "gateway_perfil", type: "exclusiveGateway", name: "¿Cumple el perfil?", lane: "lane_rh" },
        { id: "task_contrato", type: "userTask", name: "Preparar contrato", lane: "lane_rh" },
        { id: "task_alta", type: "serviceTask", name: "Dar de alta en nómina", lane: "lane_nomina" },
        { id: "end_contratado", type: "endEvent", name: "Persona contratada", lane: "lane_nomina" },
        { id: "end_rechazo", type: "endEvent", name: "Candidatura cerrada", lane: "lane_candidato" },
    ],
    edges: [
        { id: "edge_01", from: "start_solicitud", to: "task_requisicion" },
        { id: "edge_02", from: "task_requisicion", to: "task_revision" },
        { id: "edge_03", from: "task_revision", to: "gateway_completa" },
        { id: "edge_04", from: "gateway_completa", to: "task_publicar", label: "Sí" },
        { id: "edge_05", from: "gateway_completa", to: "task_requisicion", label: "No" },
        { id: "edge_06", from: "task_publicar", to: "task_postular" },
        { id: "edge_07", from: "task_postular", to: "task_entrevista" },
        { id: "edge_08", from: "task_entrevista", to: "gateway_perfil" },
        { id: "edge_09", from: "gateway_perfil", to: "task_contrato", label: "Sí" },
        { id: "edge_10", from: "gateway_perfil", to: "end_rechazo", label: "No" },
        { id: "edge_11", from: "task_contrato", to: "task_alta" },
        { id: "edge_12", from: "task_alta", to: "end_contratado" },
    ],
};
let members: Member[] = [
    { userId: "usr_mock_david", name: "David Echeverría", email: "david@bimcon.com.mx", role: "owner" },
    { userId: "usr_mock_salvador", name: "Salvador Moreno", email: "salvador@bimcon.com.mx", role: "editor" },
    { userId: "usr_mock_arturo", name: "Arturo", email: "arturo@bimcon.com.mx", role: "viewer" },
];

const clone = <T>(value: T): T => structuredClone(value);
const required = <T>(value: T | undefined, message: string): T => {
    if (!value) throw new Error(message);
    return value;
};

export const mockCurrentUser = (): User => ({ id: "usr_mock_david", name: "David Echeverría", email: "david@bimcon.com.mx", provider: "native" });

export const mockListProjects = (): Project[] => clone(projects);
export const mockGetProject = (projectId: string): Project =>
    clone(
        required(
            projects.find((project) => project.id === projectId),
            "No se encontró el proyecto mock",
        ),
    );
export const mockCreateProject = (name: string, description?: string): Project => {
    const project: Project = {
        id: `prj_mock_${crypto.randomUUID()}`,
        name,
        description,
        status: "active",
        role: "owner",
        createdBy: "usr_mock_david",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };
    projects = [project, ...projects];
    return clone(project);
};
export const mockUpdateProject = (projectId: string, patch: { name?: string; description?: string; status?: "active" | "closed" }): Project => {
    const current = required(
        projects.find((project) => project.id === projectId),
        "No se encontró el proyecto mock",
    );
    Object.assign(current, patch, { updatedAt: new Date().toISOString() });
    return clone(current);
};

export const mockListUnits = (projectId: string, kind?: UnitKind): Unit[] =>
    clone(units.filter((unit) => unit.projectId === projectId && (!kind || unit.kind === kind)));
export const mockGetUnit = (projectId: string, unitId: string): Unit =>
    clone(
        required(
            units.find((unit) => unit.projectId === projectId && unit.id === unitId),
            "No se encontró la unidad mock",
        ),
    );
export const mockCreateUnit = (projectId: string, request: { kind: UnitKind; name: string }): Unit => {
    const unit: Unit = {
        id: `unit_mock_${crypto.randomUUID()}`,
        projectId,
        kind: request.kind,
        name: request.name,
        status: "active",
        createdAt: new Date().toISOString(),
    };
    units = [...units, unit];
    return clone(unit);
};
export const mockUpdateUnit = (projectId: string, unitId: string, patch: { name?: string; status?: "draft" | "active" | "ready" }): Unit => {
    const current = required(
        units.find((unit) => unit.projectId === projectId && unit.id === unitId),
        "No se encontró la unidad mock",
    );
    Object.assign(current, patch, { updatedAt: new Date().toISOString() });
    return clone(current);
};

export const mockListSources = (projectId: string): Source[] => clone(sources.filter((source) => source.projectId === projectId));
export const mockGetSource = (projectId: string, sourceId: string): Source =>
    clone(
        required(
            sources.find((source) => source.projectId === projectId && source.id === sourceId),
            "No se encontró la fuente mock",
        ),
    );
export const mockUploadSource = (projectId: string, file: File): Source => {
    const source: Source = {
        id: `src_mock_${crypto.randomUUID()}`,
        projectId,
        name: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
        kind: file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "document",
        status: "ready",
        currentVersion: 1,
        createdAt: new Date().toISOString(),
    };
    sources = [source, ...sources];
    return clone(source);
};
export const mockDeleteSource = (projectId: string, sourceId: string): void => {
    sources = sources.filter((source) => !(source.projectId === projectId && source.id === sourceId));
};
export const mockSourceVersionList = (sourceId: string): VersionList => {
    const source = required(
        sources.find((candidate) => candidate.id === sourceId),
        "No se encontró la fuente mock",
    );
    return {
        current: `ver_mock_${source.currentVersion}`,
        versions: Array.from({ length: source.currentVersion }, (_, index) => {
            const number = source.currentVersion - index;
            return {
                id: `ver_mock_${number}`,
                number,
                createdBy: "usr_mock_david",
                createdAt: source.updatedAt ?? source.createdAt,
                comment: number === 1 ? "Carga inicial" : "Actualización de la fuente",
                origin: "real" as const,
            };
        }),
    };
};

export const mockListDeliverables = (projectId: string, options?: { unitId?: string; type?: DeliverableType }): Deliverable[] =>
    clone(
        deliverables.filter(
            (deliverable) =>
                deliverable.projectId === projectId &&
                (!options?.unitId || deliverable.unitId === options.unitId) &&
                (!options?.type || deliverable.type === options.type),
        ),
    );
export const mockGetDeliverable = (projectId: string, deliverableId: string): Deliverable =>
    clone(
        required(
            deliverables.find((deliverable) => deliverable.projectId === projectId && deliverable.id === deliverableId),
            "No se encontró el entregable mock",
        ),
    );
export const mockCreateDeliverable = (projectId: string, request: { unitId: string; type: DeliverableType; from?: string[] }): { jobId: string } => {
    const now = new Date().toISOString();
    // Este endpoint crea una sola faceta. El paquete completo pertenece a
    // mockGenerateUnit, igual que en la API real.
    const bundle: DeliverableType[] = [request.type];
    let requestedJob: Job | undefined;

    for (const type of bundle) {
        const existing = deliverables.find(
            (deliverable) => deliverable.projectId === projectId && deliverable.unitId === request.unitId && deliverable.type === type,
        );
        const deliverable: Deliverable = existing ?? {
            id: `dlv_mock_${crypto.randomUUID()}`,
            projectId,
            unitId: request.unitId,
            type,
            status: "ready",
            currentVersion: 1,
            from: request.from,
            createdAt: now,
            updatedAt: now,
        };
        if (!existing) deliverables = [...deliverables, deliverable];

        const job: Job = {
            id: `job_mock_${crypto.randomUUID()}`,
            type: `deliverable:${type}`,
            projectId,
            deliverableId: deliverable.id,
            status: "done",
            progress: 1,
            result: resultForDeliverable(type, deliverable.id),
            createdAt: now,
            updatedAt: now,
        };
        jobs = [job, ...jobs];
        if (type === request.type) requestedJob = job;
    }

    const unit = units.find((candidate) => candidate.projectId === projectId && candidate.id === request.unitId);
    if (unit) Object.assign(unit, { status: "ready", updatedAt: now });

    return { jobId: required(requestedJob, "No se pudo crear el job mock").id };
};

/** Helpers confined to the local chat tour; production versions remain server-owned. */
export const mockAdvanceDeliverableVersion = (projectId: string, deliverableId: string): Deliverable => {
    const deliverable = required(
        deliverables.find((item) => item.projectId === projectId && item.id === deliverableId),
        "No se encontró el entregable mock",
    );
    deliverable.currentVersion += 1;
    deliverable.updatedAt = new Date().toISOString();
    return clone(deliverable);
};

const chatPreviewNotes = new Map<string, Map<number, string>>();
export const mockSetChatPreviewNote = (deliverableId: string, version: number, note: string): void => {
    const versions = chatPreviewNotes.get(deliverableId) ?? new Map<number, string>();
    versions.set(version, note);
    chatPreviewNotes.set(deliverableId, versions);
};
export const mockGetChatPreviewNote = (deliverableId: string, version: number): string | undefined => chatPreviewNotes.get(deliverableId)?.get(version);

export const mockMoveChatDeliverables = (fromProjectId: string, toProjectId: string, unitIds: string[]): void => {
    for (const deliverable of deliverables) {
        if (deliverable.projectId === fromProjectId && unitIds.includes(deliverable.unitId)) deliverable.projectId = toProjectId;
    }
};

/** Job padre mock: avanza un hijo por consulta para probar polling y progreso sin timers internos. */
export const mockGenerateUnit = (
    projectId: string,
    unitId: string,
    request: { from?: string[] | null; options?: Record<string, unknown> | null } = {},
): { jobId: string } => {
    const unit = required(
        units.find((candidate) => candidate.projectId === projectId && candidate.id === unitId),
        "No se encontró la unidad mock",
    );
    const packageTypes = PACKAGE_BY_KIND[unit.kind];
    if (!packageTypes) throw new Error("Este tipo de artefacto no tiene un paquete de generación.");

    const active = jobs.find(
        (job) => packageUnitByJob.get(job.id) === unitId && !["done", "failed", "cancelled"].includes(job.status),
    );
    if (active) return { jobId: active.id };

    const now = new Date().toISOString();
    const childJobs: Job[] = packageTypes.map((type) => {
        const existing = deliverables.find(
            (deliverable) => deliverable.projectId === projectId
                && deliverable.unitId === unitId
                && deliverable.type === type
                && deliverable.status === "ready",
        );
        return {
            id: `job_mock_${crypto.randomUUID()}`,
            type: `deliverable:${type}`,
            projectId,
            deliverableId: existing?.id,
            status: existing ? "done" : "queued",
            progress: existing ? 1 : 0,
            result: existing ? resultForDeliverable(type, existing.id) : undefined,
            createdAt: now,
            updatedAt: now,
        };
    });
    const hasSources = (request.from?.length ?? 0) > 0 || sources.some((source) => source.projectId === projectId);
    const parent: Job = {
        id: `job_mock_package_${crypto.randomUUID()}`,
        type: "package",
        projectId,
        status: hasSources ? "running" : "needs_input",
        progress: childJobs.filter((child) => child.status === "done").length / childJobs.length,
        questions: hasSources
            ? undefined
            : [{
                  id: "package_sources",
                  prompt: "Sube al menos un archivo con información para preparar este artefacto.",
                  kind: "files",
                  allowedExtensions: ["pdf", "docx", "pptx", "xlsx", "csv", "txt", "mp3", "mp4"],
                  required: true,
                  category: "missing_data",
              }],
        children: childJobs.map((child, index) => ({
            jobId: child.id,
            deliverableType: packageTypes[index],
            status: child.status,
            deliverableId: child.deliverableId,
            reused: child.status === "done",
        })),
        createdAt: now,
        updatedAt: now,
    };
    packageUnitByJob.set(parent.id, unitId);
    packageRequestByJob.set(parent.id, request);
    if (childJobs.every((child) => child.status === "done")) {
        parent.status = "done";
        parent.progress = 1;
        parent.result = {
            resultKind: "package_generated",
            ok: true,
            deliverablesGenerated: childJobs.length,
            deliverablesExpected: childJobs.length,
            fieldsNotEmitted: [],
            partialReason: null,
            deepQuestionsPending: null,
            lateInputRounds: null,
            optionsIgnored: null,
            cancelRequestedTooLate: null,
        };
    }
    unit.status = "active";
    if (parent.status === "done") unit.status = "ready";
    unit.updatedAt = now;
    jobs = [parent, ...childJobs, ...jobs];
    return { jobId: parent.id };
};

const advancePackage = (parent: Job): void => {
    if (parent.type !== "package" || (parent.status !== "running" && parent.status !== "esperando")) return;
    const unitId = packageUnitByJob.get(parent.id);
    const request = packageRequestByJob.get(parent.id) ?? {};
    if (!unitId || !parent.children?.length) return;
    const next = parent.children.find((child) => !["done", "failed", "cancelled"].includes(child.status));
    if (!next) return;

    const now = new Date().toISOString();
    const childJob = required(jobs.find((job) => job.id === next.jobId), "No se encontró el job hijo mock");
    const failType = request.options?.mockFailType;
    if (failType === next.deliverableType) {
        const error = { code: "mock_generation_failed", message: "No se pudo generar este resultado en la simulación." };
        Object.assign(next, { status: "failed", error });
        Object.assign(childJob, { status: "failed", error, progress: 1, updatedAt: now });
    } else {
        let deliverable = deliverables.find(
            (candidate) => candidate.projectId === parent.projectId && candidate.unitId === unitId && candidate.type === next.deliverableType,
        );
        if (!deliverable) {
            deliverable = {
                id: `dlv_mock_${crypto.randomUUID()}`,
                projectId: parent.projectId,
                unitId,
                type: next.deliverableType,
                status: "ready",
                currentVersion: 1,
                from: request.from ?? undefined,
                createdAt: now,
                updatedAt: now,
            };
            deliverables = [...deliverables, deliverable];
        }
        const completedDeliverable = required(deliverable, "No se pudo preparar el entregable mock");
        const result = resultForDeliverable(next.deliverableType, completedDeliverable.id);
        Object.assign(next, { status: "done", deliverableId: completedDeliverable.id });
        Object.assign(childJob, { status: "done", progress: 1, deliverableId: completedDeliverable.id, result, updatedAt: now });
    }

    const completed = parent.children.filter((child) => ["done", "failed", "cancelled"].includes(child.status)).length;
    parent.progress = completed / parent.children.length;
    parent.updatedAt = now;
    if (completed < parent.children.length) return;

    const generated = parent.children.filter((child) => child.status === "done").length;
    parent.status = generated === 0 ? "failed" : "done";
    parent.result = generated === 0
        ? undefined
        : {
              resultKind: generated === parent.children.length ? "package_generated" : "package_partial",
              ok: generated === parent.children.length,
              deliverablesGenerated: generated,
              deliverablesExpected: parent.children.length,
              fieldsNotEmitted: [],
              partialReason: generated === parent.children.length ? null : "Algunos resultados requieren atención.",
              deepQuestionsPending: null,
              lateInputRounds: null,
              optionsIgnored: null,
              cancelRequestedTooLate: null,
          };
    if (generated === 0) parent.error = { code: "package_failed", message: "No se pudo generar ningún resultado." };
    const unit = units.find((candidate) => candidate.projectId === parent.projectId && candidate.id === unitId);
    if (unit) Object.assign(unit, { status: generated === parent.children.length ? "ready" : "active", updatedAt: now });
};

export const mockListJobs = (projectId?: string, status?: Job["status"]): Job[] =>
    clone(jobs.filter((job) => (!projectId || job.projectId === projectId) && (!status || job.status === status)));
export const mockGetJob = (jobId: string): Job => {
    const job = required(
        jobs.find((candidate) => candidate.id === jobId),
        "No se encontró el job mock",
    );
    advancePackage(job);
    return clone(job);
};
export const mockAnswerJob = (jobId: string, answers: { questionId: string; value: unknown }[]): void => {
    const job = required(jobs.find((candidate) => candidate.id === jobId), "No se encontró el job mock");
    const fileQuestionIds = new Set(
        (job.questions ?? []).filter((question) => question.kind === "file" || question.kind === "files").map((question) => question.id),
    );
    const referenced = answers
        .filter((answer) => fileQuestionIds.has(answer.questionId))
        .flatMap((answer) => Array.isArray(answer.value) ? answer.value : [answer.value])
        .filter((value): value is string => typeof value === "string");
    for (const sourceId of referenced) {
        if (!sources.some((source) => source.id === sourceId && source.projectId === job.projectId)) {
            throw new Error("Una de las fuentes no pertenece a este proyecto.");
        }
    }
    job.questions = undefined;
    job.status = "running";
    job.updatedAt = new Date().toISOString();
};
export const mockCancelJob = (jobId: string): void => {
    const job = required(
        jobs.find((candidate) => candidate.id === jobId),
        "No se encontró el job mock",
    );
    job.status = "cancelled";
    job.updatedAt = new Date().toISOString();
    if (job.type === "package") {
        for (const child of job.children ?? []) {
            if (["done", "failed", "cancelled"].includes(child.status)) continue;
            child.status = "cancelled";
            const childJob = jobs.find((candidate) => candidate.id === child.jobId);
            if (childJob) Object.assign(childJob, { status: "cancelled", updatedAt: job.updatedAt });
        }
    }
};

export const mockGetTranscriptionContent = (): TranscriptionContent => clone(transcriptionContent);
export const mockGetDiagramContent = (): ContractA => clone(diagramContent);
export const mockGetDeliverableContent = (type: DeliverableType): DeliverableJsonContent => {
    switch (type) {
        case "diagram_as_is": return mockGetDiagramContent();
        case "transcription": return mockGetTranscriptionContent();
        case "diagnostic": return clone(diagnosticContent);
        case "understanding": return clone(understandingContent);
        case "policy_analysis": return clone(policyAnalysisContent);
        case "policy_draft": return clone(policyDraftContent);
        default: throw new Error(`El entregable ${type} no tiene una representación JSON en el contrato V2.`);
    }
};
export const mockSaveTranscriptionContent = (projectId: string, deliverableId: string, content: TranscriptionContent): Deliverable => {
    transcriptionContent = clone(content);
    const deliverable = required(
        deliverables.find((candidate) => candidate.projectId === projectId && candidate.id === deliverableId),
        "No se encontró el entregable mock",
    );
    deliverable.currentVersion += 1;
    deliverable.updatedAt = new Date().toISOString();
    return clone(deliverable);
};
export const mockSaveDiagramContent = (projectId: string, deliverableId: string, content: ContractA): Deliverable => {
    diagramContent = clone(content);
    const deliverable = required(
        deliverables.find((candidate) => candidate.projectId === projectId && candidate.id === deliverableId),
        "No se encontró el entregable mock",
    );
    deliverable.currentVersion += 1;
    deliverable.updatedAt = new Date().toISOString();
    return clone(deliverable);
};
export const mockVersionList = (deliverableId: string): VersionList => {
    const deliverable = required(
        deliverables.find((candidate) => candidate.id === deliverableId),
        "No se encontró el entregable mock",
    );
    return {
        current: `ver_mock_${deliverable.currentVersion}`,
        versions: Array.from({ length: deliverable.currentVersion }, (_, index) => {
            const number = deliverable.currentVersion - index;
            return {
                id: `ver_mock_${number}`,
                number,
                createdBy: "usr_mock_david",
                createdAt: UPDATED_AT,
                comment: number === 1 ? "Generación inicial" : "Edición desde la interfaz",
                origin: "real" as const,
            };
        }),
    };
};

export const mockListMembers = (): Member[] => clone(members);
export const mockAddMember = (userId: string, role: Role): Member => {
    const existing = members.find((member) => member.userId === userId || member.email === userId);
    if (existing) {
        existing.role = role;
        return clone(existing);
    }
    const member: Member = {
        userId: userId.includes("@") ? `usr_mock_${crypto.randomUUID()}` : userId,
        email: userId.includes("@") ? userId : undefined,
        name: userId.includes("@") ? userId.split("@")[0] : userId,
        role,
    };
    members = [...members, member];
    return clone(member);
};
export const mockUpdateMember = (userId: string, role: Role): Member => {
    const member = required(
        members.find((candidate) => candidate.userId === userId),
        "No se encontró el miembro mock",
    );
    member.role = role;
    return clone(member);
};
export const mockRemoveMember = (userId: string): void => {
    members = members.filter((member) => member.userId !== userId);
};

export const mockBlob = (name: string): Blob => new Blob([`Archivo mock: ${name}`], { type: "text/plain;charset=utf-8" });
