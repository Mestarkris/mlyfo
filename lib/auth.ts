import { cookies } from "next/headers";
import { db } from "./db";
import { token } from "./crypto";

export const SESSION_COOKIE = "mlyfo_session";

export type User = {
  id: number; name: string; email: string; handle: string; address: string;
  balance_cents: number; daily_limit_cents: number; per_payment_cents: number; new_recipient_cents: number;
  shield_lookalike: number; shield_scamlist: number; shield_links: number; created_at: string;
};

const USER_COLS =
  "u.id,u.name,u.email,u.handle,u.address,u.balance_cents,u.daily_limit_cents,u.per_payment_cents,u.new_recipient_cents,u.shield_lookalike,u.shield_scamlist,u.shield_links,u.created_at";

export function createSession(userId: number): string {
  const t = token();
  db().prepare("INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,datetime('now','+30 days'))").run(t, userId);
  return t;
}

export async function setSessionCookie(t: string) {
  (await cookies()).set(SESSION_COOKIE, t, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production" && process.env.MLYFO_INSECURE_COOKIE !== "1",
  });
}

export async function currentUser(): Promise<User | null> {
  const t = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!t) return null;
  const u = db()
    .prepare(`SELECT ${USER_COLS} FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > datetime('now')`)
    .get(t) as User | undefined;
  return u ?? null;
}

export function userById(id: number): User | null {
  return (db().prepare(`SELECT ${USER_COLS} FROM users u WHERE u.id = ?`).get(id) as User | undefined) ?? null;
}

export async function endSession() {
  const jar = await cookies();
  const t = jar.get(SESSION_COOKIE)?.value;
  if (t) db().prepare("DELETE FROM sessions WHERE token = ?").run(t);
  jar.delete(SESSION_COOKIE);
}
