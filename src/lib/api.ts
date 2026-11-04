import createClient from "openapi-fetch";
import type { paths } from "./api-schema";
import { announceSessionExpired, isProtectedApiRequest } from "./session-expiry";

/**
 * Cliente tipado del contrato API v2 (generado de `contract/openapi-v2.yaml`, que es el
 * submódulo del repo del contrato). Toda llamada al back v2 pasa por acá: el compilador
 * valida ruta, params, body y respuesta contra el contrato.
 *
 * Si el contrato cambia: `npm run gen:api` regenera los tipos y el compilador marca
 * exactamente qué del front se rompió. Nada de adivinar campos.
 *
 * El prefijo es siempre /api/v2. Dev y preview lo redirigen según el modo explícito
 * de Vite; producción lo sirve a través del proxy HTTPS del despliegue.
 */
export async function sessionAwareFetch(request: Request): Promise<Response> {
    const response = await globalThis.fetch(request);
    if (response.status === 401 && isProtectedApiRequest(request.url)) announceSessionExpired();
    return response;
}

export const api = createClient<paths>({
    baseUrl: "/api/v2",
    credentials: "include",
    fetch: sessionAwareFetch,
});
