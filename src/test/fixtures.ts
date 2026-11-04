import type { Job, JobChild, PackageResult, Question, Source } from "@/services/v2/types";

export const makeQuestion = (patch: Partial<Question> = {}): Question => ({
    id: "question_1",
    prompt: "Completa la información",
    kind: "text",
    required: true,
    ...patch,
});

export const makeSource = (patch: Partial<Source> = {}): Source => ({
    id: "source_1",
    projectId: "project_1",
    name: "Proceso.pdf",
    mime: "application/pdf",
    kind: "document",
    status: "ready",
    currentVersion: 1,
    createdAt: "2026-09-22T12:00:00Z",
    ...patch,
});

export const makeChild = (patch: Partial<JobChild> = {}): JobChild => ({
    jobId: "child_1",
    deliverableType: "understanding",
    status: "running",
    ...patch,
});

export const makePackageResult = (patch: Partial<PackageResult> = {}): PackageResult => ({
    resultKind: "package_generated",
    ok: true,
    deliverablesGenerated: 3,
    deliverablesExpected: 3,
    fieldsNotEmitted: [],
    partialReason: null,
    deepQuestionsPending: null,
    lateInputRounds: null,
    optionsIgnored: null,
    cancelRequestedTooLate: null,
    ...patch,
});

export const makeJob = (patch: Partial<Job> = {}): Job => ({
    id: "job_1",
    type: "package",
    projectId: "project_1",
    status: "running",
    progress: 0.4,
    createdAt: "2026-09-22T12:00:00Z",
    updatedAt: "2026-09-22T12:00:00Z",
    ...patch,
});
