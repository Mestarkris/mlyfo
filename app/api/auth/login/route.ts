import { db } from "@/lib/db";
import { checkPassword } from "@/lib/crypto";
import { createSession, setSessionCookie } from "@/lib/auth";
import { json, bad, body } from "@/lib/http";

export async function POST(req: Request) {
  const { email = "", password = "" } = await body<Record<string, string>>(req);
  const u = db().prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email.trim().toLowerCase()) as { id: number; password_hash: string } | undefined;
  if (!u || !checkPassword(password, u.password_hash)) return bad("That email and password don’t match an account.", 401);
  await setSessionCookie(createSession(u.id));
  return json({ ok: true });
}
