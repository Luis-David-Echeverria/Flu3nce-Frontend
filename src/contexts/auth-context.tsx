import { createContext, useContext, useEffect, useState, type PropsWithChildren } from "react";
import { authService, type CurrentUser as User } from "@/services/auth-service";
import { markSessionActive, SESSION_EXPIRED_EVENT } from "@/lib/session-expiry";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    sessionExpired: boolean;
    refreshUser: () => Promise<void>;
    setUserFromLogin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [sessionExpired, setSessionExpired] = useState(false);

    const refreshUser = async () => {
        try {
            const userData = await authService.me();
            setUser(userData);
            markSessionActive();
            setSessionExpired(false);
        } catch (error) {
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    // Confirma que la cookie dejada por login sirve para la sesión v2.
    const setUserFromLogin = async () => {
        try {
            const userData = await authService.me();
            setUser(userData);
            markSessionActive();
            setSessionExpired(false);
        } catch (error) {
            setUser(null);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    useEffect(() => {
        const onSessionExpired = () => {
            setUser(null);
            setIsLoading(false);
            setSessionExpired(true);
        };
        window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
        return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    }, []);

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated: !!user,
        sessionExpired,
        refreshUser,
        setUserFromLogin,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuthContext must be used within an AuthProvider");
    }
    return context;
};
