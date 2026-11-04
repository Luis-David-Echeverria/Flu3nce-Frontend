import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));

vi.mock("@/lib/api", () => ({ api: apiMock }));
vi.mock("@/config/api-mode", () => ({ isMockMode: false }));

import { authService, PASSWORD_MIN_LENGTH } from "./auth-service";

beforeEach(() => {
    apiMock.GET.mockReset();
    apiMock.POST.mockReset();
});

describe("authService v2", () => {
    it("conserva las capacidades efectivas sin deducirlas del nombre del perfil", async () => {
        apiMock.GET.mockResolvedValue({ data: { id: "user_1", profile: "perfil_desconocido", capabilities: ["chat", "stream", "futura"] } });
        const user = await authService.me();
        expect(user.profile).toBe("perfil_desconocido");
        expect(user.capabilities).toEqual(["chat", "stream", "futura"]);
    });
    it("inicia sesión sin almacenar tokens en el cliente", async () => {
        apiMock.POST.mockResolvedValue({ data: { id: "user_1", name: "QA", email: "qa@bimcon.com.mx", provider: "native" } });
        await expect(authService.login({ userId: "qa", password: "password-seguro" })).resolves.toEqual({
            userId: "user_1",
            displayName: "QA",
            email: "qa@bimcon.com.mx",
            provider: "native",
        });
        expect(apiMock.POST).toHaveBeenCalledWith("/auth/login", { body: { userId: "qa", password: "password-seguro" } });
        expect(window.localStorage).toHaveLength(0);
        expect(window.sessionStorage).toHaveLength(0);
    });

    it("comprueba la sesión mediante GET /me", async () => {
        apiMock.GET.mockResolvedValue({ data: { id: "user_1", name: "QA", provider: "microsoft" } });
        await expect(authService.me()).resolves.toEqual({ userId: "user_1", displayName: "QA", provider: "microsoft" });
        expect(apiMock.GET).toHaveBeenCalledWith("/me");
    });

    it("cierra la sesión en el backend", async () => {
        apiMock.POST.mockResolvedValue({ error: undefined });
        await authService.logout();
        expect(apiMock.POST).toHaveBeenCalledWith("/auth/logout");
    });

    it("valida la contraseña antes de enviar un restablecimiento", async () => {
        await expect(authService.resetPassword("token", "corta")).rejects.toThrow(`al menos ${PASSWORD_MIN_LENGTH}`);
        expect(apiMock.POST).not.toHaveBeenCalled();
    });

    it("no oculta errores públicos de autenticación", async () => {
        apiMock.POST.mockResolvedValue({ error: { code: "invalid_credentials", message: "Usuario o contraseña incorrectos." } });
        await expect(authService.login({ userId: "qa", password: "incorrecta" })).rejects.toThrow("Usuario o contraseña incorrectos.");
    });
});
