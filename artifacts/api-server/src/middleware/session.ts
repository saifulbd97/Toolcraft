import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";

const PgSession = ConnectPgSimple(session);

const secret = process.env["SESSION_SECRET"] || "fallback-dev-secret-change-in-prod";

export function createSessionMiddleware() {
  return session({
    store: new PgSession({
      conString: process.env["DATABASE_URL"],
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
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
