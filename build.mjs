/**
 * Root build script — called by `npm run build`.
 * Uses pnpm internally for workspace package management,
 * but the top-level interface is plain npm.
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const root = path.dirname(fileURLToPath(import.meta.url));

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}${cwd !== root ? ` (in ${path.relative(root, cwd)})` : ""}`);
  execSync(cmd, { cwd, stdio: "inherit" });
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
