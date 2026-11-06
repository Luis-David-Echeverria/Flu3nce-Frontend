import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const report = JSON.parse(execFileSync(process.execPath, ["scripts/audit-source.mjs"], { encoding: "utf8" }));
const supportingFiles = new Set(["src/components/custom/bpmn-editor/pipeline/contracts/contract-a.schema.json"]);
const orphans = report.unused.filter((file) => !supportingFiles.has(file));
if (orphans.length) throw new Error(`Unused source files:\n${orphans.join("\n")}`);
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const declared = { ...pkg.dependencies, ...pkg.devDependencies };
const missing = report.packages.filter((name) => !declared[name]);
if (missing.length) throw new Error(`Undeclared dependencies: ${missing.join(", ")}`);
const routes = fs.readFileSync("src/app-routes.tsx", "utf8");
for (const old of ["/flu/chats", "/flu/legacy", "/flu/real", "/procesos/", "/normativa/", "/gamma", "/inicio"]) {
    if (routes.includes(`path="${old}`)) throw new Error(`Legacy route: ${old}`);
}
if (process.argv.includes("--dist")) {
    if (!fs.existsSync("dist/index.html")) throw new Error("Build the production bundle first.");
    const inspect = (directory) => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) inspect(file);
            else if (file.endsWith(".js")) {
                const text = fs.readFileSync(file, "utf8");
                if (/chat_mock_tour|prj_mock_reclutamiento|MAQUETA LOCAL|predeterminado de ejemplo|fluence_session=dev/.test(text)) throw new Error(`Test/demo data in production bundle: ${file}`);
            }
        }
    };
    inspect("dist");

    // Presupuesto de peso (gzip). Lo inicial es lo que carga index.html antes de mostrar algo;
    // el chat es la pantalla principal. Si una dependencia nueva lo rebasa, cárgala a demanda.
    const budgets = { initialKb: 140, chatKb: 120 };
    const gzipKb = (file) => zlib.gzipSync(fs.readFileSync(file)).length / 1024;
    const html = fs.readFileSync("dist/index.html", "utf8");
    const initialFiles = [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css))"/g)].map((match) => path.join("dist", match[1]));
    const initialKb = initialFiles.reduce((total, file) => total + gzipKb(file), 0);
    const chatChunk = fs.readdirSync("dist/assets").find((name) => /^flu-chats-.*\.js$/.test(name));
    const chatKb = chatChunk ? gzipKb(path.join("dist/assets", chatChunk)) : 0;
    console.log(`Bundle (gzip): initial ${initialKb.toFixed(1)} KB of ${budgets.initialKb} KB; chat ${chatKb.toFixed(1)} KB of ${budgets.chatKb} KB.`);
    if (initialKb > budgets.initialKb) throw new Error(`Initial bundle is ${initialKb.toFixed(1)} KB gzip; the budget is ${budgets.initialKb} KB. Load the new code on demand.`);
    if (chatKb > budgets.chatKb) throw new Error(`Chat chunk is ${chatKb.toFixed(1)} KB gzip; the budget is ${budgets.chatKb} KB. Load heavy views on demand.`);
}
console.log(`Frontend current: ${report.reachable} reachable source/assets; no orphan modules or legacy routes.`);
