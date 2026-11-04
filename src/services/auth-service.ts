import { api } from "@/lib/api";
import { isMockMode } from "@/config/api-mode";

import { apiError } from "./v2/http";
import type { User } from "./v2/types";

const SSO_START_URL = "https://agentes.bimcon.com.mx/v2/auth";

export interface CurrentUser {
    userId: string;
    displayName?: string;
    email?: string;
    provider?: "native" | "google" | "microsoft";
    profile?: User["profile"];
    capabilities?: User["capabilities"];
}

export interface LoginRequest {
    userId: string;
    password: string;
}

export const PASSWORD_MIN_LENGTH = 8;

function toCurrentUser(user: User): CurrentUser {
    return {
        userId: user.id,
        displayName: user.name ?? undefined,
        email: user.email ?? undefined,
        provider: user.provider ?? undefined,
        ...(user.profile !== undefined ? { profile: user.profile } : {}),
        ...(user.capabilities !== undefined ? { capabilities: user.capabilities } : {}),
    };
}

/**
 * Autenticación v2 basada únicamente en la cookie de sesión HttpOnly.
 * El front no lee ni persiste tokens/sessionId: después de login, `GET /me`
 * confirma la sesión que dejó el servidor.
 */
export const authService = {
    login: async (credentials: LoginRequest): Promise<CurrentUser> => {
        if (isMockMode) return toCurrentUser((await import("@/mocks/api-store")).mockCurrentUser());
        const { data, error } = await api.POST("/auth/login", { body: { userId: credentials.userId, password: credentials.password } });
        if (error || !data) throw apiError(error, "No se pudo iniciar sesión");
        return toCurrentUser(data);
    },

    me: async (): Promise<CurrentUser> => {
        if (isMockMode) return toCurrentUser((await import("@/mocks/api-store")).mockCurrentUser());
        const { data, error } = await api.GET("/me");
        if (error || !data) throw apiError(error, "No se pudo comprobar la sesión");
        return toCurrentUser(data);
    },

    logout: async (): Promise<void> => {
        if (isMockMode) return;
        const { error } = await api.POST("/auth/logout");
        if (error) throw apiError(error, "No se pudo cerrar sesión");
    },

    forgotPassword: async (email: string): Promise<void> => {
        if (isMockMode) return;
        const { error } = await api.POST("/auth/forgot-password", { body: { email } });
        if (error) throw apiError(error, "No se pudo solicitar la recuperación de contraseña");
    },

    resetPassword: async (token: string, password: string): Promise<void> => {
        if (password.length < PASSWORD_MIN_LENGTH) {
            throw new Error(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres`);
        }
        if (isMockMode) return;
        const { error } = await api.POST("/auth/reset-password", { body: { token, password } });
        if (error) throw apiError(error, "No se pudo restablecer la contraseña");
    },

    loginWithProvider: (provider: "google" | "microsoft") => {
        if (isMockMode) {
            window.location.assign("/");
            return;
        }
        // OAuth necesita una navegación de primer nivel al backend. Evitar el proxy
        // relativo también mantiene intactos el origen del callback y la cookie SSO.
        window.location.assign(`${SSO_START_URL}/${provider}/start`);
    },

    loginWithMicrosoft: () => authService.loginWithProvider("microsoft"),
    loginWithGoogle: () => authService.loginWithProvider("google"),
};
