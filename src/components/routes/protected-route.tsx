import { Navigate, Outlet } from "react-router";
import { useAuthContext } from "@/contexts/auth-context";

export const ProtectedRoute = () => {
    const { isAuthenticated, isLoading, sessionExpired } = useAuthContext();

    // Mientras verifica la autenticación, mostrar un loader
    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="text-gray-600">Cargando...</div>
            </div>
        );
    }

    // Si no está autenticado, redirigir al login
    if (!isAuthenticated) {
        return <Navigate to={sessionExpired ? "/login?sessionExpired=1" : "/login"} replace />;
    }

    // Si está autenticado, renderizar las rutas hijas
    return <Outlet />;
};
