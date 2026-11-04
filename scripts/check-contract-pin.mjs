import { execFileSync } from "node:child_process";

const runGit = (args, cwd) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const contractGit = (...args) => runGit(args, "contract");

try {
    const recorded = runGit(["ls-tree", "HEAD", "contract"]);
    const pin = recorded.split(/\s+/)[2];
    const checkedOut = contractGit("rev-parse", "HEAD");
    const main = contractGit("rev-parse", "origin/main");
    if (!pin) throw new Error("No se encontró el gitlink de contract en HEAD.");
    let belongsToMain = true;
    try {
        execFileSync("git", ["-C", "contract", "merge-base", "--is-ancestor", pin, main], { stdio: "ignore" });
    } catch {
        belongsToMain = false;
    }

    console.log(`Pin versionado:   ${pin}`);
    console.log(`Checkout local:   ${checkedOut}`);
    console.log(`origin/main:      ${main}`);

    if (checkedOut !== pin) {
        console.error("El checkout local del submódulo no coincide con el pin versionado. Cambia el checkout al pin antes de verificar o integra y versiona el nuevo pin.");
        process.exitCode = 1;
    }

    if (!belongsToMain) {
        console.error("El pin del contrato no pertenece a origin/main. Mergea primero el PR del contrato y actualiza el submódulo al commit integrado.");
        process.exit(1);
    }
} catch (error) {
    console.error("No se pudo verificar el pin del contrato. Inicializa el submódulo y trae origin/main antes de ejecutar el gate.");
    if (process.env.DEBUG_CONTRACT_PIN === "1") console.error(error);
    process.exit(1);
}
