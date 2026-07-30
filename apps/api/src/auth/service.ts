import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const SECRET = process.env.APP_SECRET ?? "dev-secret-change-me";
const ENC_KEY = crypto.createHash("sha256").update(SECRET).digest(); // 32 bytes

// ── passwords (scrypt, no native deps) ──
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, salt, 64).toString("hex");
  return h.length === hash.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

// ── PIN / safe-word (one-way, salted with the app secret) ──
export function hashSecret(s: string): string {
  return crypto.createHash("sha256").update(s.trim().toLowerCase() + SECRET).digest("hex");
}
export function verifySecret(input: string, stored?: string | null): boolean {
  if (!stored) return true; // none set
  return hashSecret(input) === stored;
}

// ── owner-key encryption (AES-256-GCM) ──
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENC_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}
export function decrypt(payload: string): string {
  const [ivH, tagH, encH] = payload.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENC_KEY, Buffer.from(ivH!, "hex"));
  decipher.setAuthTag(Buffer.from(tagH!, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encH!, "hex")), decipher.final()]).toString("utf8");
}

// ── sessions (JWT) ──
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { expiresIn: "30d" });
}
export function userIdFromAuthHeader(header?: string): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const p = jwt.verify(header.slice(7), SECRET) as { sub?: string };
    return p.sub ?? null;
  } catch {
    return null;
  }
}
