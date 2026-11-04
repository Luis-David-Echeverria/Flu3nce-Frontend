import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
    PATCH: vi.fn(),
    DELETE: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));

import { createDeliverable, DeliverableConflictError, saveDeliverableContent } from "./deliverables";
import { answerJob, cancelJob, getJob, listJobs } from "./jobs";
import { addMember, MemberConflictError, removeMember, updateMemberRole } from "./members";
import { createProject, listProjects, listProjectsPage, renameProject } from "./projects";
import { deleteSource, listSources, uploadSource } from "./sources";

const project = {
    id: "project_1",
    name: "Proyecto",
    status: "active" as const,
    role: "owner" as const,
    createdAt: "2026-09-22T12:00:00Z",
};

beforeEach(() => {
    for (const method of Object.values(apiMock)) method.mockReset();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("servicios HTTP v2", () => {
    it("mapea proyectos y roles del contrato al modelo visual", async () => {
        apiMock.GET.mockResolvedValue({ data: { projects: [project, { ...project, id: "project_2", role: "viewer" }] } });

        await expect(listProjects()).resolves.toEqual([
            expect.objectContaining({ id: "project_1", rol: "propietario" }),
            expect.objectContaining({ id: "project_2", rol: "lector" }),
        ]);
        expect(apiMock.GET).toHaveBeenCalledWith("/projects");
    });

    it("pagina proyectos para la barra sin descargar el directorio completo", async () => {
        apiMock.GET.mockResolvedValue({ data: { projects: [project], nextCursor: "pagina_2" } });
        await expect(listProjectsPage(10)).resolves.toEqual({ projects: [expect.objectContaining({ id: "project_1" })], nextCursor: "pagina_2" });
        expect(apiMock.GET).toHaveBeenCalledWith("/projects", { params: { query: { limit: 10, cursor: undefined } } });
    });

    it("envía creación y renombrado de proyecto con el cuerpo exacto", async () => {
        apiMock.POST.mockResolvedValue({ data: project });
        apiMock.PATCH.mockResolvedValue({ data: { ...project, name: "Nuevo nombre" } });

        await createProject("Proyecto", "Descripción");
        await renameProject("project_1", "Nuevo nombre");

        expect(apiMock.POST).toHaveBeenCalledWith("/projects", { body: { name: "Proyecto", description: "Descripción" } });
        expect(apiMock.PATCH).toHaveBeenCalledWith("/projects/{projectId}", {
            params: { path: { projectId: "project_1" } },
            body: { name: "Nuevo nombre" },
        });
    });

    it("propaga filtros al listar jobs y devuelve el cursor", async () => {
        apiMock.GET.mockResolvedValue({ data: { jobs: [{ id: "job_1", status: "running" }], nextCursor: "cursor_2" } });
        await expect(listJobs({ status: "running", projectId: "project_1", limit: 10, cursor: "cursor_1" })).resolves.toEqual({
            jobs: [{ id: "job_1", status: "running" }],
            nextCursor: "cursor_2",
        });
        expect(apiMock.GET).toHaveBeenCalledWith("/jobs", {
            params: { query: { status: "running", projectId: "project_1", limit: 10, cursor: "cursor_1" } },
        });
    });

    it("consulta, responde y cancela jobs mediante el padre", async () => {
        apiMock.GET.mockResolvedValue({ data: { id: "job_1", status: "needs_input" } });
        apiMock.POST
            .mockResolvedValueOnce({ data: undefined, error: undefined })
            .mockResolvedValueOnce({ data: { effect: "requested" }, error: undefined });

        await expect(getJob("job_1")).resolves.toEqual({ id: "job_1", status: "needs_input" });
        await answerJob("job_1", [{ questionId: "q1", value: "Finanzas" }]);
        await expect(cancelJob("job_1")).resolves.toEqual({ effect: "requested" });

        expect(apiMock.POST).toHaveBeenNthCalledWith(1, "/jobs/{jobId}/answers", {
            params: { path: { jobId: "job_1" } },
            body: { answers: [{ questionId: "q1", value: "Finanzas" }] },
        });
        expect(apiMock.POST).toHaveBeenNthCalledWith(2, "/jobs/{jobId}/cancel", {
            params: { path: { jobId: "job_1" } },
        });
    });

    it("crea entregables individuales con su unidad, tipo y fuentes", async () => {
        apiMock.POST.mockResolvedValue({ data: { jobId: "job_1" } });
        await createDeliverable("project_1", {
            unitId: "unit_1",
            type: "diagram_as_is",
            from: ["source_1"],
            options: { maxSteps: 50 },
        });
        expect(apiMock.POST).toHaveBeenCalledWith("/projects/{projectId}/deliverables", {
            params: { path: { projectId: "project_1" } },
            body: {
                unitId: "unit_1",
                type: "diagram_as_is",
                from: ["source_1"],
                options: { maxSteps: 50 },
            },
        });
    });

    it("sube fuentes como multipart y conserva el comentario", async () => {
        const uploaded = { id: "source_1", name: "proceso.pdf" };
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(uploaded), {
            status: 201,
            headers: { "content-type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);

        const file = new File(["contenido"], "proceso.pdf", { type: "application/pdf" });
        await expect(uploadSource("project/1", file, "Versión aprobada")).resolves.toEqual(uploaded);

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/v2/projects/project%2F1/sources");
        expect(init.credentials).toBe("include");
        expect(init.body).toBeInstanceOf(FormData);
        expect((init.body as FormData).get("file")).toBe(file);
        expect((init.body as FormData).get("comment")).toBe("Versión aprobada");
    });

    it("no oculta errores públicos al subir una fuente", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "El formato no es compatible." }), {
            status: 415,
            headers: { "content-type": "application/json" },
        })));
        await expect(uploadSource("project_1", new File(["x"], "archivo.exe"))).rejects.toThrow("El formato no es compatible.");
    });

    it("detecta conflicto de versión al guardar un entregable", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 412 })));
        await expect(saveDeliverableContent("project_1", "deliverable_1", { schemaVersion: "contrato-a" }, 2))
            .rejects.toBeInstanceOf(DeliverableConflictError);
    });

    it("convierte el 409 de miembros ambiguos en una decisión visible", async () => {
        apiMock.POST.mockResolvedValue({
            error: {
                message: "Más de una cuenta",
                detail: { candidates: [{ userId: "user_1", email: "qa@bimcon.com.mx" }, { id: "user_2", name: "QA externo" }] },
            },
            response: { status: 409 },
        });

        const error = await addMember("project_1", "qa@bimcon.com.mx", "editor").catch((caught) => caught);
        expect(error).toBeInstanceOf(MemberConflictError);
        expect((error as MemberConflictError).candidates).toEqual([
            { userId: "user_1", email: "qa@bimcon.com.mx", name: undefined, projects: undefined },
            { userId: "user_2", email: undefined, name: "QA externo", projects: undefined },
        ]);
    });

    it("actualiza y elimina miembros usando el userId de la ruta", async () => {
        apiMock.PATCH.mockResolvedValue({ data: { userId: "user_2", role: "viewer" } });
        apiMock.DELETE.mockResolvedValue({ error: undefined });

        await updateMemberRole("project_1", "user_2", "viewer");
        await removeMember("project_1", "user_2");

        expect(apiMock.PATCH).toHaveBeenCalledWith("/projects/{projectId}/members/{userId}", {
            params: { path: { projectId: "project_1", userId: "user_2" } },
            body: { role: "viewer" },
        });
        expect(apiMock.DELETE).toHaveBeenCalledWith("/projects/{projectId}/members/{userId}", {
            params: { path: { projectId: "project_1", userId: "user_2" } },
        });
    });

    it("elimina fuentes dentro del proyecto correcto", async () => {
        apiMock.DELETE.mockResolvedValue({ error: undefined });
        await deleteSource("project_1", "source_1");
        expect(apiMock.DELETE).toHaveBeenCalledWith("/projects/{projectId}/sources/{sourceId}", {
            params: { path: { projectId: "project_1", sourceId: "source_1" } },
        });
    });

    it("normaliza páginas vacías sin inventar elementos", async () => {
        apiMock.GET.mockResolvedValue({ data: {} });
        await expect(listSources("project_1")).resolves.toEqual({ sources: [], nextCursor: undefined });
    });
});
