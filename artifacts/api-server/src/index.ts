import app from "./app";
import { logger } from "./lib/logger";

process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[fatal] Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  console.error(`[fatal] Invalid PORT value: "${rawPort}"`);
  process.exit(1);
}

app.listen(port, "0.0.0.0", (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});
