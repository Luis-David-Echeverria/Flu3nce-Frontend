/**
 * El modo se elige con el modo nativo de Vite:
 *   npm run dev:mock -> datos locales, deterministas y tipados por el contrato
 *   npm run dev:real -> API v2 real
 *
 * Producción nunca entra aquí como mock: `vite build` usa MODE=production.
 */
export const API_MODE = import.meta.env.MODE === "mock" ? "mock" : "real";
export const isMockMode = API_MODE === "mock";
