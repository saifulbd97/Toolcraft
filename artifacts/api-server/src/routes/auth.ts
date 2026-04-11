import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"];
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"];
const oauthEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

if (oauthEnabled) {
  const getCallbackURL = () => {
    if (process.env["APP_URL"]) return `${process.env["APP_URL"]}/api/auth/google/callback`;
    const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0];
    if (domain) return `https://${domain}/api/auth/google/callback`;
    return "http://localhost:8080/api/auth/google/callback";
  };

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID as string,
        clientSecret: GOOGLE_CLIENT_SECRET as string,
        callbackURL: getCallbackURL(),
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user = {
          id: profile.id,
          name: profile.displayName,
          email: profile.emails?.[0]?.value ?? "",
          photo: profile.photos?.[0]?.value ?? "",
        };
        return done(null, user);
      }
    )
  );
} else {
  console.warn("[auth] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — Google OAuth disabled");
}

const ALLOWED_RETURN_PATHS = new Set(["/income"]);
const DEFAULT_RETURN = "/income";

const router = Router();

if (oauthEnabled) {
  router.get("/auth/google", (req, res, next) => {
    const returnTo = req.query["returnTo"] as string | undefined;
    if (returnTo && ALLOWED_RETURN_PATHS.has(returnTo)) {
      req.session.returnTo = returnTo;
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=1" }),
    (req, res) => {
      const returnTo = req.session.returnTo;
      delete req.session.returnTo;
      const dest = returnTo && ALLOWED_RETURN_PATHS.has(returnTo) ? returnTo : DEFAULT_RETURN;
      res.redirect(dest);
    }
  );
} else {
  router.get("/auth/google", (_req, res) => {
    res.status(503).json({ error: "Google OAuth is not configured on this server" });
  });
  router.get("/auth/google/callback", (_req, res) => {
    res.status(503).json({ error: "Google OAuth is not configured on this server" });
  });
}

router.get("/auth/me", (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

router.post("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });
});

export default router;
