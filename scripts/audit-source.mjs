import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const files = [];
function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(file);
        else files.push(file);
    }
}
walk(path.join(root, "src"));
const relative = (file) => path.relative(root, file).replaceAll("\\", "/");
function resolve(from, name) {
    const clean = name.split("?")[0];
    const base = clean.startsWith("@/") ? path.join(root, "src", clean.slice(2)) : clean.startsWith(".") ? path.resolve(path.dirname(from), clean) : undefined;
    return base && [base, ...[".ts", ".tsx", ".js", ".jsx", ".css", ".json", "/index.ts", "/index.tsx"].map((extension) => base + extension)].map((candidate) => path.normalize(candidate)).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}
const imports = new Map();
const external = new Map();
for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const names = ts.preProcessFile(content, true, true).importedFiles.map((item) => item.fileName);
    for (const match of content.matchAll(/new URL\(["']([^"']+)["'],\s*import\.meta\.url\)/g)) names.push(match[1]);
    if (file.endsWith(".css")) for (const match of content.matchAll(/@import\s+["']([^"']+)["']/g)) names.push(match[1]);
    if (file.endsWith(".css")) for (const match of content.matchAll(/@plugin\s+["']([^"']+)["']/g)) names.push(match[1]);
    imports.set(file, names.map((name) => resolve(file, name)).filter(Boolean));
    external.set(file, names.filter((name) => !name.startsWith(".") && !name.startsWith("@/")).map((name) => name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0]));
}
const roots = (process.argv.slice(2).length ? process.argv.slice(2) : ["src/main.tsx"]).map((file) => path.resolve(root, file));
const reached = new Set();
function visit(file) { if (reached.has(file)) return; reached.add(file); for (const target of imports.get(file) ?? []) visit(target); }
for (const file of roots) { if (!fs.existsSync(file)) throw new Error(`Entry point not found: ${relative(file)}`); visit(file); }
const unused = files.filter((file) => !reached.has(file) && !/\.test\.[tj]sx?$|\.d\.ts$/.test(file) && !relative(file).startsWith("src/test/"));
console.log(JSON.stringify({ total: files.length, reachable: reached.size, unused: unused.map(relative), packages: [...new Set([...reached].flatMap((file) => external.get(file) ?? []))].sort(), reachablePages: [...reached].map(relative).filter((file) => file.startsWith("src/pages/")) }, null, 2));
