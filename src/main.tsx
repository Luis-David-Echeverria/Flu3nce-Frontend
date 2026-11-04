import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { ErrorBoundary } from "@/components/error-boundary";
import { AuthProvider } from "@/contexts/auth-context";
import { RouteProvider } from "@/providers/router-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { AppRoutes } from "@/app-routes";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ErrorBoundary>
            <ThemeProvider defaultTheme="light">
                <BrowserRouter>
                    <AuthProvider>
                        <RouteProvider><AppRoutes /></RouteProvider>
                    </AuthProvider>
                </BrowserRouter>
            </ThemeProvider>
        </ErrorBoundary>
    </StrictMode>,
);
