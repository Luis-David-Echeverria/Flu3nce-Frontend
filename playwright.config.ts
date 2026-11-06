import { defineConfig, devices } from "@playwright/test";

const port = 4174;

/** Pruebas en navegador real sobre `dev:mock`: prueban la interfaz, no el backend. */
export default defineConfig({
    testDir: "e2e",
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: `http://127.0.0.1:${port}`,
        trace: "retain-on-failure",
        locale: "es-MX",
    },
    webServer: {
        command: `npm run dev:mock -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}/flu`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
