import { Router } from "express";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

const GOOGLE_CLIENT_ID = process.env["GOOGLE_CLIENT_ID"]!;
const GOOGLE_CLIENT_SECRET = process.env["GOOGLE_CLIENT_SECRET"]!;

const getCallbackURL = () => {
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

const router = Router();

router.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login?error=1" }),
  (_req, res) => {
    res.redirect("/");
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
