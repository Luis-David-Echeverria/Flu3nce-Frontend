import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const generator = join(root, "node_modules", "openapi-typescript", "bin", "cli.js");
const committedTypes = join(root, "src", "lib", "api-schema.d.ts");
const scratch = mkdtempSync(join(tmpdir(), "fluence-api-schema-"));
const generatedTypes = join(scratch, "api-schema.d.ts");

try {
    execFileSync(process.execPath, [generator, "contract/openapi-v2.yaml", "-o", generatedTypes], {
        cwd: root,
        stdio: "inherit",
    });

    if (!readFileSync(committedTypes).equals(readFileSync(generatedTypes))) {
        console.error("src/lib/api-schema.d.ts no coincide con el contrato local. Ejecuta npm run gen:api y revisa el diff antes de compartir la rama.");
        process.exitCode = 1;
    } else {
        console.log("Los tipos del frontend coinciden con contract/openapi-v2.yaml.");
    }
} catch (error) {
    console.error("No se pudo comprobar el esquema generado. Instala las dependencias y verifica el submódulo contract.");
    if (process.env.DEBUG_API_SCHEMA === "1") console.error(error);
    process.exitCode = 1;
} finally {
    if (existsSync(generatedTypes)) unlinkSync(generatedTypes);
    rmdirSync(scratch);
}
