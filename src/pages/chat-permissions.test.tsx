import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const setPermission = vi.hoisted(() => vi.fn());
vi.mock("@/services/v2/source-permissions", () => ({ setSourcePermission: setPermission }));
import { ChatPermissions } from "./chat-permissions";

afterEach(() => { cleanup(); setPermission.mockReset(); });

describe("permisos pendientes estructurados", () => {
    it("concede exactamente el archivo y proveedor elegidos y no inicia una generación", async () => {
        setPermission.mockResolvedValue({ permissions: [] });
        const changed = vi.fn();
        render(<ChatPermissions projectId="p1" canWrite onGranted={changed} pending={[{ sourceId: "s1", sourceName: "Entrevista.mp3", providers: ["gamma"] }]} />);
        fireEvent.click(screen.getByRole("button", { name: "Permitir Gamma" }));
        await waitFor(() => expect(setPermission).toHaveBeenCalledWith("p1", "s1", "gamma", true));
        expect(await screen.findByRole("status")).toHaveTextContent("No se inició una generación nueva");
        expect(changed).toHaveBeenCalledOnce();
    });
    it("muestra los proveedores nuevos sin inventar una ruta ni ofrecer un permiso que no sabe conceder", () => {
        render(<ChatPermissions projectId="p1" canWrite pending={[{ sourceId: "s1", providers: ["future_provider"] }]} />);
        expect(screen.getByText(/future_provider/)).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
    it("también interpreta la acción tipada del error cuando no hay lista permissionsPending", async () => {
        setPermission.mockResolvedValue({ permissions: [] });
        render(<ChatPermissions projectId="p1" canWrite action={{ kind: "grant_permission", sourceIds: ["s2"], providers: ["openai"] }} />);
        fireEvent.click(screen.getByRole("button", { name: "Permitir OpenAI" }));
        await waitFor(() => expect(setPermission).toHaveBeenCalledWith("p1", "s2", "openai", true));
    });
});
