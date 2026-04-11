/**
 * Build script for Toolcraft.
 *
 * Runs two sequential builds:
 *   1. Vite   → artifacts/pdf-merger/dist/public/  (React frontend)
 *   2. esbuild → artifacts/api-server/dist/index.mjs (Express backend)
 *
 * Usage:
 *   npm run build
 */
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, cwd = root) {
  const rel = path.relative(root, cwd) || ".";
  console.log(`\n[build] ${cmd}  (cwd: ${rel})`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

const viteBin = path.join(root, "node_modules", ".bin", "vite");
const pdfMergerDir = path.join(root, "artifacts", "pdf-merger");
const apiServerDir = path.join(root, "artifacts", "api-server");

console.log("=== Building React frontend ===");
run(`"${viteBin}" build --config vite.config.ts`, pdfMergerDir);

console.log("\n=== Building Express API server ===");
run(`node build.mjs`, apiServerDir);

console.log("\nBuild complete.");
console.log("  Frontend : artifacts/pdf-merger/dist/public/");
console.log("  Server   : artifacts/api-server/dist/index.mjs");
