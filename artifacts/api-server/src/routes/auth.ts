import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"]!;
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"]!;

const getCallbackURL = () => {
  // Production (Render, etc.): set APP_URL=https://your-app.onrender.com
  if (process.env["APP_URL"]) return `${process.env["APP_URL"]}/api/auth/google/callback`;
  // Replit dev environment
  const domain = process.env["REPLIT_DEV_DOMAIN"] || process.env["REPLIT_DOMAINS"]?.split(",")[0];
  if (domain) return `https://${domain}/api/auth/google/callback`;
  return "http://localhost:8080/api/auth/google/callback";
};

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
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

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user as Express.User));

const ALLOWED_RETURN_PATHS = new Set(["/income"]);
const DEFAULT_RETURN = "/income";

const router = Router();

router.get("/auth/google", (req, res, next) => {
  const returnTo = req.query["returnTo"] as string | undefined;
  if (returnTo && ALLOWED_RETURN_PATHS.has(returnTo)) {
    (req.session as Record<string, unknown>)["returnTo"] = returnTo;
  }
  passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=1" }),
  (req, res) => {
    const returnTo = (req.session as Record<string, unknown>)["returnTo"] as string | undefined;
    delete (req.session as Record<string, unknown>)["returnTo"];
    const dest = returnTo && ALLOWED_RETURN_PATHS.has(returnTo) ? returnTo : DEFAULT_RETURN;
    res.redirect(dest);
  }
);

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
