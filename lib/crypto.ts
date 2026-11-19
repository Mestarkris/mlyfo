import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function checkPassword(pw: string, stored: string): boolean {
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const key = scryptSync(pw, Buffer.from(saltHex, "hex"), 32);
  return timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}

export function token(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** A random Solana-format (base58, 44 char) address for a demo wallet. */
export function demoAddress(): string {
  const b = randomBytes(44);
  let s = "";
  for (const x of b) s += B58[x % 58];
  return s;
}

export function isSolanaAddress(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}
