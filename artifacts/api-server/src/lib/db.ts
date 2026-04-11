import crypto from "crypto";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  referralId: string;
  referredBy: string | null;
  income: number;
  referrals: string[];
  createdAt: Date;
}

const users = new Map<string, User>();
const emailIndex = new Map<string, string>();
const referralIndex = new Map<string, string>();

function generateId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function generateReferralId(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "toolcraft-salt").digest("hex");
}

export type SafeUser = Omit<User, "passwordHash">;

export const db = {
  createUser(
    email: string,
    password: string,
    name: string,
    referralCode?: string
  ): SafeUser {
    const normalizedEmail = email.toLowerCase().trim();

    if (emailIndex.has(normalizedEmail)) {
      throw new Error("Email already registered");
    }

    let referredBy: string | null = null;
    if (referralCode) {
      const referrerId = referralIndex.get(referralCode.toUpperCase());
      if (referrerId) referredBy = referrerId;
    }

    const id = generateId();
    const referralId = generateReferralId();

    const user: User = {
      id,
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      name: name.trim(),
      referralId,
      referredBy,
      income: 0,
      referrals: [],
      createdAt: new Date(),
    };

    users.set(id, user);
    emailIndex.set(normalizedEmail, id);
    referralIndex.set(referralId, id);

    if (referredBy) {
      const referrer = users.get(referredBy);
      if (referrer) {
        referrer.referrals.push(id);
        referrer.income += 5;
      }
    }

    return this._safe(user);
  },

  login(email: string, password: string): SafeUser | null {
    const id = emailIndex.get(email.toLowerCase().trim());
    if (!id) return null;
    const user = users.get(id);
    if (!user) return null;
    if (user.passwordHash !== hashPassword(password)) return null;
    return this._safe(user);
  },

  getById(id: string): SafeUser | null {
    const user = users.get(id);
    return user ? this._safe(user) : null;
  },

  _safe(user: User): SafeUser {
    const { passwordHash: _, ...safe } = user;
    return safe;
  },
};
