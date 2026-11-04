// Tipos de la API v2 = los del contrato, sin reescribir a mano.
// Se derivan de `components["schemas"]` generado de contract/openapi-v2.yaml
// (npm run gen:api). Si el contrato cambia, estos alias cambian con él y el
// compilador marca qué del front se rompe.
import type { components } from "@/lib/api-schema";

export type Project = components["schemas"]["Project"];
export type Source = components["schemas"]["Source"];
export type ChainBlock = components["schemas"]["ChainBlock"];
export type ChainActivityStage = components["schemas"]["ChainActivityStage"];
export type PermissionPending = components["schemas"]["PermissionPending"];
export type DocumentContent = components["schemas"]["DocumentContent"];
export type Member = components["schemas"]["Member"];
export type Role = Project["role"];
export type Unit = components["schemas"]["Unit"];
export type UnitKind = Unit["kind"];
export type Deliverable = components["schemas"]["Deliverable"];
export type DeliverablePreview = components["schemas"]["DeliverablePreview"];
export type DeliverableType = components["schemas"]["DeliverableType"];
export type Version = components["schemas"]["Version"];
export type VersionList = components["schemas"]["VersionList"];
export type Question = components["schemas"]["Question"];
export type JobChild = components["schemas"]["JobChild"];
export type PackageResult = components["schemas"]["PackageResult"];
// La UI de revisiones ya usa estos campos del PR #25. El PR #28 de /chats
// todavía parte del contrato anterior; mantenerlos como compatibilidad local
// hasta que ambos cambios se consoliden en main.
export type Job = components["schemas"]["Job"] & {
    revision?: {
        baseVersion: { deliverableId: string; versionId: string; number: number };
        executionScope: "targeted_change" | "full_regeneration";
        changedParts?: string[];
    };
};
export type GenerationIntent = Omit<components["schemas"]["GenerationIntent"], "intentKind"> & {
    intentKind?: "generate" | "save_context" | "revise_deliverable" | (string & {});
};
export type ConsultationMessage = Omit<components["schemas"]["ConsultationMessage"], "intent"> & {
    intent?: GenerationIntent;
};
export type ConsultationSession = Omit<components["schemas"]["ConsultationSession"], "messages"> & {
    messages: ConsultationMessage[];
    revisionIntentsEnabled?: boolean;
};
export type QuestionGroup = components["schemas"]["QuestionGroup"];
export type RevisionProposal = components["schemas"]["RevisionProposal"];
export type ContextContribution = components["schemas"]["ContextContribution"];
export type ContextProposal = components["schemas"]["ContextProposal"];
export type SourceRef = components["schemas"]["SourceRef"];
export type JobResult = Exclude<NonNullable<Job["result"]>, PackageResult>;
export type JobRef = components["schemas"]["JobRef"];
export type GenerateRequest = components["schemas"]["GenerateRequest"];
export type DiagnosticResult = components["schemas"]["DiagnosticResult"];
export type DiagramAsIsResult = components["schemas"]["DiagramAsIsResult"];
export type UnderstandingResult = components["schemas"]["UnderstandingResult"];
export type PresentationResult = components["schemas"]["PresentationResult"];
export type TranslationResult = components["schemas"]["TranslationResult"];
export type SourceUsed = components["schemas"]["SourceUsed"];
export type PolicyAnalysisResult = components["schemas"]["PolicyAnalysisResult"];
export type PolicyDraftResult = components["schemas"]["PolicyDraftResult"];
export type TranscriptionResult = components["schemas"]["TranscriptionResult"];
export type ReusedResult = components["schemas"]["ReusedResult"];
export type ContractA = components["schemas"]["ContractA"];
export type TranscriptionContent = components["schemas"]["TranscriptionContent"];
export type TranscriptionSegment = components["schemas"]["TranscriptionSegment"];
export type DiagnosticContent = components["schemas"]["DiagnosticContent"];
export type UnderstandingContent = components["schemas"]["UnderstandingContent"];
export type PolicyAnalysisContent = components["schemas"]["PolicyAnalysisContent"];
export type PolicyDraftContent = components["schemas"]["PolicyDraftContent"];
export type RepresentationNotAvailable = components["schemas"]["RepresentationNotAvailable"];
export type DeliverableJsonContent =
    | ContractA
    | TranscriptionContent
    | DiagnosticContent
    | UnderstandingContent
    | PolicyAnalysisContent
    | PolicyDraftContent
    | DocumentContent;
export type User = components["schemas"]["User"];

export function isPackageResult(result: Job["result"]): result is PackageResult {
    return result?.resultKind === "package_generated" || result?.resultKind === "package_partial";
}

export function isDeliverableResult(result: Job["result"]): result is JobResult {
    return !!result && !isPackageResult(result);
}

export type IgnoredGenerationOption = NonNullable<PackageResult["optionsIgnored"]>[number];

export function ignoredOptionsFromPackageResult(result: Job["result"]): IgnoredGenerationOption[] {
    if (!isPackageResult(result)) return [];
    const ignored = result.optionsIgnored;
    return Array.isArray(ignored) ? ignored : [];
}

export function deliverableIdFromJob(job: Job): string | undefined {
    return (isDeliverableResult(job.result) ? job.result.deliverableId ?? undefined : undefined) ?? job.deliverableId ?? undefined;
}
