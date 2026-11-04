import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ GET: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: calls }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));
import { setSourcePermission } from "./source-permissions";

beforeEach(() => {
    calls.GET.mockReset().mockResolvedValue({ data: { sourceId: "source_1", permissions: [{ provider: "openai", granted: false }] } });
    calls.PUT.mockReset().mockResolvedValue({ data: { provider: "openai", granted: true } });
    calls.DELETE.mockReset().mockResolvedValue({ data: undefined, error: undefined });
});

describe("permiso por archivo y proveedor", () => {
    it("relee los permisos tras revocar porque DELETE responde 204 sin JSON", async () => {
        const result = await setSourcePermission("project_1", "source_1", "openai", false);
        expect(calls.DELETE).toHaveBeenCalledWith("/projects/{projectId}/sources/{sourceId}/permissions/{provider}", { params: { path: { projectId: "project_1", sourceId: "source_1", provider: "openai" } } });
        expect(calls.GET).toHaveBeenCalledOnce();
        expect(result.permissions[0].granted).toBe(false);
    });
});
