export const SESSION_EXPIRED_EVENT = "fluence:session-expired";

let sessionExpiryAnnounced = false;

/** Un 401 en una ruta protegida invalida la sesión una sola vez. */
export function announceSessionExpired(): void {
    if (typeof window === "undefined" || sessionExpiryAnnounced) return;
    sessionExpiryAnnounced = true;
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

/** Permite detectar una futura caducidad después de iniciar sesión. */
export function markSessionActive(): void {
    sessionExpiryAnnounced = false;
}

export function isProtectedApiRequest(url: string): boolean {
    const path = new URL(url, typeof window === "undefined" ? "http://localhost" : window.location.origin).pathname;
    return path.startsWith("/api/v2/") && !/^\/api\/v2\/(?:auth(?:\/|$)|me$)/.test(path);
}
