import { q } from "@/lib/db";
import { hashPassword, demoAddress } from "@/lib/crypto";
import { createSession, setSessionCookie } from "@/lib/auth";
import { json, bad, body } from "@/lib/http";

export async function POST(req: Request) {
  const { name = "", email = "", handle = "", password = "" } = await body<Record<string, string>>(req);
  const n = name.trim(), e = email.trim().toLowerCase(), h = handle.trim().replace(/^@/, "").toLowerCase();
  if (n.length < 2) return bad("Enter your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return bad("Enter a valid email address.");
  if (!/^[a-z0-9_]{3,20}$/.test(h)) return bad("Usernames use 3 to 20 letters, numbers or underscores.");
  if (password.length < 10) return bad("Use at least 10 characters for your password.");
  if (await q.get("SELECT 1 AS x FROM users WHERE email = ?", e)) return bad("An account with this email already exists. Sign in instead.", 409);
  if (await q.get("SELECT 1 AS x FROM users WHERE handle = ?", h)) return bad(`@${h} is taken. Try another username.`, 409);
  const r = await q.run("INSERT INTO users (name,email,handle,password_hash,address) VALUES (?,?,?,?,?)", n, e, h, hashPassword(password), demoAddress());
  await setSessionCookie(await createSession(r.lastInsertRowid));
  return json({ ok: true, handle: h }, 201);
}
