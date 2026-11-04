import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ isAuthenticated: true, isLoading: false, sessionExpired: false }));
vi.mock("@/contexts/auth-context", () => ({ useAuthContext: () => auth }));
vi.mock("@/pages/login", () => ({ LoginPage: () => <p>Acceso a Flu3nce</p> }));
vi.mock("@/pages/reset-password", () => ({ ResetPasswordPage: () => <p>Restablecer contraseña</p> }));
vi.mock("@/pages/not-found", () => ({ NotFound: () => <p>Página no encontrada</p> }));
vi.mock("@/pages/landing", () => ({ LandingPage: () => <p>Presentación pública</p> }));
vi.mock("@/pages/flu-chats", async () => {
    const { useLocation } = await import("react-router");
    return { FluChatsPage: () => { const location = useLocation(); return <p>Chat actual: {location.pathname}{location.search}</p>; } };
});
vi.mock("@/pages/bpmn-editor", () => ({ BpmnEditorPage: () => <p>Editor del entregable</p> }));
import { AppRoutes } from "./app-routes";
beforeEach(() => { auth.isAuthenticated = true; });
afterEach(cleanup);

describe("rutas del producto actual", () => {
    it("conserva los parámetros del chat en la ruta actual", async () => {
        render(<MemoryRouter initialEntries={["/flu?chat=chat1"]}><AppRoutes /></MemoryRouter>);
        expect(await screen.findByText("Chat actual: /flu?chat=chat1")).toBeInTheDocument();
    });
    it("protege el chat y el editor con la sesión real", async () => {
        auth.isAuthenticated = false;
        render(<MemoryRouter initialEntries={["/flu/diagrams/d1?project=p1"]}><AppRoutes /></MemoryRouter>);
        expect(await screen.findByText("Acceso a Flu3nce")).toBeInTheDocument();
        expect(screen.queryByText("Editor del entregable")).not.toBeInTheDocument();
    });
    it.each(["/flu/chats", "/flu/legacy", "/flu/real", "/procesos/todos", "/procesos/nuevo", "/gamma", "/bpmn-editor"])("no monta un flujo antiguo en %s", async (url) => {
        render(<MemoryRouter initialEntries={[url]}><AppRoutes /></MemoryRouter>);
        expect(await screen.findByText("Página no encontrada")).toBeInTheDocument();
    });
});
