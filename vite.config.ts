import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import type { IncomingMessage } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv, type ProxyOptions } from "vite";

// Cookie changes apply only to the localhost dev/preview proxy.
function localhostCookies(response: IncomingMessage) {
    response.headers["set-cookie"] = response.headers["set-cookie"]?.map((cookie) => cookie
        .replace(/; *Domain=[^;]*/gi, "")
        .replace(/; *Secure/gi, "")
        .replace(/; *SameSite=none/gi, "; SameSite=Lax"));
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "FLUENCE_");
    const mock = mode === "mock";
    const api: ProxyOptions = {
        target: mock ? env.FLUENCE_MOCK_TARGET || "http://localhost:4010" : env.FLUENCE_API_TARGET || "https://agentes.bimcon.com.mx",
        changeOrigin: true,
        timeout: 600000,
        proxyTimeout: 600000,
        rewrite: (url) => url.replace(/^\/api\/v2/, mock ? "" : "/v2"),
        configure: (proxy) => {
            if (mock) proxy.on("proxyReq", (request) => request.setHeader("cookie", "fluence_session=dev"));
            else proxy.on("proxyRes", localhostCookies);
        },
    };
    return {
        plugins: [react(), tailwindcss()],
        resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
        build: { chunkSizeWarningLimit: 1000 },
        server: { port: 5174, strictPort: true, proxy: { "/api/v2": api } },
        preview: { proxy: { "/api/v2": api } },
    };
});
