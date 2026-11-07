import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, ".vercel/output/static");
const shellPath = join(src, "_shell.html");
const dest = join(root, "dist/client");

if (!existsSync(shellPath)) {
  console.error("Falta .vercel/output/static/_shell.html. El build del APK no terminó el shell.");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
writeFileSync(join(dest, "index.html"), readFileSync(shellPath));
console.log("Listo dist/client (index.html = shell de la app).");
