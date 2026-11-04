import { useState } from "react";
import { authService, type LoginRequest } from "@/services/auth-service";

export const useAuth = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const login = async (credentials: LoginRequest) => {
        try {
            setLoading(true);
            setError(null);
            const response = await authService.login(credentials);
            return response;
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al iniciar sesión");
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await authService.logout();
        } catch (err) {
            console.error("Error al cerrar sesión:", err);
        }
        window.location.href = "/login";
    };

    const checkAuth = async () => {
        try {
            await authService.me();
            return true;
        } catch (error) {
            return false;
        }
    };

    return {
        login,
        logout,
        checkAuth,
        loading,
        error,
    };
};
