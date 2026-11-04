import { beforeEach, describe, expect, it, vi } from "vitest";
import { sessionAwareFetch } from "./api";
import { announceSessionExpired, isProtectedApiRequest, markSessionActive, SESSION_EXPIRED_EVENT } from "./session-expiry";

beforeEach(() => {
    markSessionActive();
    vi.unstubAllGlobals();
});

describe("sesión caducada", () => {
    it("distingue rutas protegidas de login y comprobación inicial", () => {
        expect(isProtectedApiRequest("/api/v2/jobs/job_1")).toBe(true);
        expect(isProtectedApiRequest("/api/v2/projects/prj_1/sources")).toBe(true);
        expect(isProtectedApiRequest("/api/v2/auth/login")).toBe(false);
        expect(isProtectedApiRequest("/api/v2/me")).toBe(false);
    });

    it("anuncia una sola vez cada caducidad", () => {
        const listener = vi.fn();
        window.addEventListener(SESSION_EXPIRED_EVENT, listener);
        try {
            announceSessionExpired();
            announceSessionExpired();
            expect(listener).toHaveBeenCalledOnce();
            markSessionActive();
            announceSessionExpired();
            expect(listener).toHaveBeenCalledTimes(2);
        } finally {
            window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
        }
    });

    it("un 401 del sondeo de jobs caduca la sesión, pero uno de login no", async () => {
        const listener = vi.fn();
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "unauthorized", message: "Sesión caducada" }), {
            status: 401,
            headers: { "content-type": "application/json" },
        }));
        vi.stubGlobal("fetch", fetchMock);
        window.addEventListener(SESSION_EXPIRED_EVENT, listener);
        try {
            await sessionAwareFetch(new Request("http://localhost/api/v2/jobs/job_1"));
            expect(listener).toHaveBeenCalledOnce();
            markSessionActive();
            await sessionAwareFetch(new Request("http://localhost/api/v2/auth/login", { method: "POST" }));
            expect(listener).toHaveBeenCalledOnce();
        } finally {
            window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
        }
    });
});
