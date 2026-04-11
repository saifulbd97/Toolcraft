import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";

const PgSession = ConnectPgSimple(session);

const secret = process.env["SESSION_SECRET"] || "fallback-dev-secret-change-in-prod";

export function createSessionMiddleware() {
  const databaseUrl = process.env["DATABASE_URL"];

  if (!databaseUrl) {
    console.warn(
      "[session] DATABASE_URL not set — using in-memory session store. " +
        "Sessions will be lost on restart. Set DATABASE_URL for persistent sessions."
    );
  }

  const store = databaseUrl
    ? new PgSession({
        conString: databaseUrl,
        tableName: "user_sessions",
        createTableIfMissing: true,
        errorLog: (err: unknown) => {
          console.error("[session] Session store error:", err);
        },
      })
    : undefined;

  return session({
    store,
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env["NODE_ENV"] === "production",
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
    },
  });
}
