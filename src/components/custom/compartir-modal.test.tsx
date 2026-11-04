import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const membersApi = vi.hoisted(() => ({
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
}));

vi.mock("@/services/v2/members", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/services/v2/members")>();
    return { ...actual, ...membersApi };
});

import { CompartirModal } from "./compartir-modal";
import { MemberConflictError } from "@/services/v2/members";

const owner = { userId: "owner_1", name: "David", email: "david@bimcon.com.mx", role: "owner" as const };
const collaborator = { userId: "user_2", name: "QA Colaborador", email: "qa@bimcon.com.mx", role: "viewer" as const };

beforeEach(() => {
    membersApi.listMembers.mockReset().mockResolvedValue([owner, collaborator]);
    membersApi.addMember.mockReset().mockResolvedValue(collaborator);
    membersApi.removeMember.mockReset().mockResolvedValue(undefined);
    membersApi.updateMemberRole.mockReset().mockResolvedValue({ ...collaborator, role: "editor" });
});

describe("CompartirModal", () => {
    it("permite al propietario invitar con un rol explícito", async () => {
        const user = userEvent.setup();
        render(<CompartirModal open projectId="project_1" projectName="Cobranza" miRol="propietario" onClose={vi.fn()} />);
        await screen.findByText("QA Colaborador");

        await user.type(screen.getByPlaceholderText("correo del colaborador"), "nuevo@bimcon.com.mx");
        await user.selectOptions(screen.getByRole("combobox", { name: "Rol del nuevo colaborador" }), "editor");
        await user.click(screen.getByRole("button", { name: "Invitar" }));

        expect(membersApi.addMember).toHaveBeenCalledWith("project_1", "nuevo@bimcon.com.mx", "editor");
        await waitFor(() => expect(membersApi.listMembers).toHaveBeenCalledTimes(2));
    });

    it("permite cambiar el rol y quitar a un colaborador", async () => {
        const user = userEvent.setup();
        render(<CompartirModal open projectId="project_1" miRol="propietario" onClose={vi.fn()} />);
        await screen.findByText("QA Colaborador");

        await user.selectOptions(screen.getByRole("combobox", { name: "Rol de QA Colaborador" }), "editor");
        expect(membersApi.updateMemberRole).toHaveBeenCalledWith("project_1", "user_2", "editor");
        await waitFor(() => expect(membersApi.listMembers).toHaveBeenCalledTimes(2));

        await user.click(screen.getByRole("button", { name: "Quitar" }));
        expect(membersApi.removeMember).toHaveBeenCalledWith("project_1", "user_2");
    });

    it("resuelve un correo ambiguo mediante los candidatos del 409", async () => {
        const user = userEvent.setup();
        membersApi.addMember
            .mockRejectedValueOnce(new MemberConflictError("Varias cuentas", [
                { userId: "candidate_1", name: "Cuenta interna", email: "qa@bimcon.com.mx", projects: 2 },
                { userId: "candidate_2", name: "Cuenta externa", email: "qa@bimcon.com.mx", projects: 0 },
            ]))
            .mockResolvedValueOnce(collaborator);
        render(<CompartirModal open projectId="project_1" miRol="propietario" onClose={vi.fn()} />);
        await screen.findByText("QA Colaborador");

        await user.type(screen.getByPlaceholderText("correo del colaborador"), "qa@bimcon.com.mx");
        await user.click(screen.getByRole("button", { name: "Invitar" }));
        expect(await screen.findByText(/varias cuentas/)).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: /Cuenta interna/ }));

        expect(membersApi.addMember).toHaveBeenNthCalledWith(2, "project_1", "candidate_1", "viewer");
    });

    it("impide que editores y lectores gestionen accesos", async () => {
        render(<CompartirModal open projectId="project_1" miRol="editor" onClose={vi.fn()} />);
        await screen.findByText("QA Colaborador");
        expect(screen.queryByPlaceholderText("correo del colaborador")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Quitar" })).not.toBeInTheDocument();
        expect(screen.getByText("Solo el propietario puede gestionar los accesos.")).toBeInTheDocument();
    });
});
