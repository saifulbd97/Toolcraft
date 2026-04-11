/**
 * Root build script — called by `npm run build`.
 *
 * Uses pnpm internally for workspace dependency management.
 * Automatically installs pnpm if it is not already available,
 * so the top-level interface works with plain npm:
 *
 *   npm install   (installs root devDeps: typescript, prettier)
 *   npm run build (this script)
 *   npm start
 */
import { execSync, spawnSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}${cwd !== root ? ` (in ${path.relative(root, cwd)})` : ""}`);
  execSync(cmd, { cwd, stdio: "inherit" });
}

function hasPnpm() {
  const result = spawnSync("pnpm", ["--version"], { stdio: "ignore" });
  return result.status === 0;
}

// Auto-install pnpm if not available (e.g. on Render)
if (!hasPnpm()) {
  console.log("pnpm not found — installing pnpm@10 via npm...");
  run("npm install -g pnpm@10");
}

// Install all workspace dependencies
run("pnpm install");

// Build React frontend (outputs to artifacts/pdf-merger/dist/public/)
run("pnpm run build", path.join(root, "artifacts/pdf-merger"));

// Build Express API server (outputs to artifacts/api-server/dist/index.mjs)
run("pnpm run build", path.join(root, "artifacts/api-server"));

console.log("\nBuild complete.");
console.log("  Frontend : artifacts/pdf-merger/dist/public/");
console.log("  Server   : artifacts/api-server/dist/index.mjs");
