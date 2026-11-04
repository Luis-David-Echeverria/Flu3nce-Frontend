import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({ me: vi.fn() }));
vi.mock("@/services/auth-service", () => ({ authService: authMock }));

import { ProtectedRoute } from "@/components/routes/protected-route";
import { announceSessionExpired, markSessionActive } from "@/lib/session-expiry";
import { AuthProvider } from "./auth-context";

function LoginDestination() {
    const location = useLocation();
    return <p>{location.pathname + location.search}</p>;
}

beforeEach(() => {
    markSessionActive();
    authMock.me.mockReset().mockResolvedValue({ userId: "qa_owner" });
});

describe("AuthProvider", () => {
    it("sale de la ruta protegida y lleva al login cuando caduca la sesión", async () => {
        render(
            <MemoryRouter initialEntries={["/protected"]}>
                <AuthProvider>
                    <Routes>
                        <Route path="/login" element={<LoginDestination />} />
                        <Route element={<ProtectedRoute />}>
                            <Route path="/protected" element={<p>Trabajo protegido</p>} />
                        </Route>
                    </Routes>
                </AuthProvider>
            </MemoryRouter>,
        );

        expect(await screen.findByText("Trabajo protegido")).toBeInTheDocument();
        announceSessionExpired();
        await waitFor(() => expect(screen.getByText("/login?sessionExpired=1")).toBeInTheDocument());
        expect(screen.queryByText("Trabajo protegido")).not.toBeInTheDocument();
    });
});
