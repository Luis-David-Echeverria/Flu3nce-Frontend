import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";
import { ProtectedRoute } from "@/components/routes/protected-route";
import { AppLayout } from "@/pages/layouts/navigation-layout";
import { LoginPage } from "@/pages/login";
import { ResetPasswordPage } from "@/pages/reset-password";
import { NotFound } from "@/pages/not-found";

const FluChatsPage = lazy(() => import("@/pages/flu-chats").then((module) => ({ default: module.FluChatsPage })));
const BpmnEditorPage = lazy(() => import("@/pages/bpmn-editor").then((module) => ({ default: module.BpmnEditorPage })));
const LandingPage = lazy(() => import("@/pages/landing").then((module) => ({ default: module.LandingPage })));

export function AppRoutes() {
    return <Suspense fallback={<div role="status" className="grid min-h-dvh place-items-center text-sm text-[color:var(--fl-text-4)]">Cargando Flu3nce…</div>}>
        <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/flu" replace />} />
                    <Route path="/flu" element={<FluChatsPage />} />
                    <Route path="/flu/diagrams/:deliverableId" element={<BpmnEditorPage />} />
                </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
        </Routes>
    </Suspense>;
}
