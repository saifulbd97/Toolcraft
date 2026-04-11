import { Router } from "express";
import { db } from "../lib/db";

const router = Router();

router.post("/auth/register", (req, res) => {
  const { email, password, name, referralCode } = req.body ?? {};

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }

  if (typeof password !== "string" || password.length < 4 || password.length > 8) {
    res.status(400).json({ error: "Password must be 4–8 characters" });
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  try {
    const user = db.createUser(email, password, name, referralCode);
    req.session.localUserId = user.id;
    res.json({ user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    res.status(400).json({ error: message });
  }
});

router.post("/auth/login", (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = db.login(email, password);
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  req.session.localUserId = user.id;
  res.json({ user });
});

router.get("/user/me", (req, res) => {
  const userId = req.session.localUserId;
  if (!userId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const user = db.getById(userId);
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ user });
});

router.post("/user/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

export default router;
