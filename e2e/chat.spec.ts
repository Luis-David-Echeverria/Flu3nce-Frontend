import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Recorridos de la interfaz en `dev:mock`. Que pasen aquí no prueba que funcionen con el API real.

function watchErrors(page: Page) {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    return errors;
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
    const path = testInfo.outputPath(`${name}.png`);
    await page.screenshot({ path, fullPage: false });
    await testInfo.attach(name, { path, contentType: "image/png" });
}

async function startChat(page: Page, text: string) {
    await page.goto("/flu");
    await page.getByLabel("Tu primer mensaje").fill(text);
    await page.getByRole("button", { name: "Enviar primer mensaje" }).click();
    await expect(page.getByRole("article", { name: /^Respuesta de Flu3nce/ }).first()).toBeVisible();
}

test("responde en el chat con una tabla y deja copiarla o bajarla", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await startChat(page, "Dame una tabla de responsables del proceso de compras");
    await expect(page.getByRole("article", { name: /^Tu mensaje/ }).first()).toContainText("Dame una tabla de responsables");
    await expect(page.getByRole("button", { name: "Copiar respuesta" }).first()).toBeVisible();
    await expect(page.getByLabel("Mensaje para Flu3nce")).toBeEnabled();
    await expect(page.getByRole("button", { name: "Copiar tabla" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Descargar CSV" }).click();
    expect((await download).suggestedFilename()).toBe("tabla-flu3nce.csv");
    await capture(page, testInfo, "chat-claro");
    expect(errors).toEqual([]);
});

test("el borrador del primer mensaje sobrevive a recargar la página", async ({ page }) => {
    await page.goto("/flu");
    await page.getByLabel("Tu primer mensaje").fill("Borrador que todavía no envío");
    await page.reload();
    await expect(page.getByLabel("Tu primer mensaje")).toHaveValue("Borrador que todavía no envío");
});

test("a 390 px no hay desplazamiento horizontal y el compositor queda a la vista", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await startChat(page, "Resume el proceso de compras en tres puntos");
    await expect(page.getByLabel("Mensaje para Flu3nce")).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await capture(page, testInfo, "chat-390");
    expect(errors).toEqual([]);
});

test("en modo oscuro usa los tokens oscuros", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => window.localStorage.setItem("ui-theme", "dark"));
    await startChat(page, "¿Qué riesgos tiene el proceso de compras?");
    await expect(page.locator("html")).toHaveClass(/dark-mode/);
    const background = await page.evaluate(() => getComputedStyle(document.querySelector(".flu-main") ?? document.body).backgroundColor);
    const [red, green, blue] = background.match(/\d+/g)!.map(Number);
    expect((red + green + blue) / 3).toBeLessThan(60);
    await capture(page, testInfo, "chat-oscuro");
    expect(errors).toEqual([]);
});

test("lo pedido se genera sin botón de confirmar y deja el entregable en el chat", async ({ page }, testInfo) => {
    const errors = watchErrors(page);
    await startChat(page, "Quiero una política de compras menores");
    await page.getByLabel("Mensaje para Flu3nce").fill("Aplica a todas las áreas; compras menores de $10,000 requieren aprobación de Dirección.");
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    await expect(page.getByText("Voy a preparar el borrador de política con lo conversado.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar/ })).toHaveCount(0);
    await expect(page.getByText(/Puedes revisar la versión 1/).first()).toBeVisible({ timeout: 15_000 });
    await capture(page, testInfo, "chat-generado");
    expect(errors).toEqual([]);
});


for (const view of [{ name: "bienvenida-claro", width: 1280, dark: false }, { name: "bienvenida-oscuro", width: 1280, dark: true }, { name: "bienvenida-390", width: 390, dark: false }]) {
    test(`la bienvenida ofrece todas las capacidades (${view.name})`, async ({ page }, testInfo) => {
        const errors = watchErrors(page);
        if (view.dark) await page.addInitScript(() => window.localStorage.setItem("ui-theme", "dark"));
        await page.setViewportSize({ width: view.width, height: 844 });
        await page.goto("/flu");
        await expect(page.getByRole("heading", { name: "¿Qué quieres trabajar hoy?" })).toBeVisible();
        const capabilities = page.getByRole("group", { name: "Lo que Flu3nce puede hacer contigo" }).getByRole("button");
        await expect(capabilities).toHaveCount(9);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        await capture(page, testInfo, view.name);
        await capabilities.filter({ hasText: "Ayúdame a traducir un documento" }).click();
        await expect(page.getByLabel("Tu primer mensaje")).toHaveValue("Ayúdame a traducir un documento");
        expect(errors).toEqual([]);
    });
}
