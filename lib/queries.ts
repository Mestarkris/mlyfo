import { db } from "./db";
import { splitDetail } from "./money";

export type Activity = { id: number; kind: "out" | "in"; amount_cents: number; status: string; reason: string; note: string; created_at: string; other: string; emoji: string };

export function activity(userId: number, limit = 8): Activity[] {
  return db().prepare(`
    SELECT p.id, CASE WHEN p.from_user = ? THEN 'out' ELSE 'in' END AS kind, p.amount_cents, p.status, p.reason, p.note, p.created_at,
      CASE WHEN p.from_user = ?
        THEN COALESCE((SELECT label FROM contacts c WHERE c.user_id = ? AND c.address = p.to_address), (SELECT '@'||handle FROM users WHERE id = p.to_user), substr(p.to_address,1,4)||'…'||substr(p.to_address,-4))
        ELSE (SELECT '@'||handle FROM users WHERE id = p.from_user) END AS other,
      COALESCE((SELECT emoji FROM contacts c WHERE c.user_id = ? AND c.address = p.to_address AND p.from_user = ?), CASE WHEN p.from_user = ? THEN '↗' ELSE '↙' END) AS emoji
    FROM payments p
    WHERE (p.from_user = ? OR (p.to_user = ? AND p.status = 'sent')) AND p.status != 'pending'
    ORDER BY p.id DESC LIMIT ?`).all(userId, userId, userId, userId, userId, userId, userId, userId, limit) as Activity[];
}

export function pendingConfirmations(userId: number) {
  return activity(userId, 50).filter((a) => a.kind === "out" && a.status === "needs_confirmation");
}

export function splitsFor(userId: number) {
  const ids = db().prepare("SELECT id FROM splits WHERE owner_id = ? ORDER BY id DESC").all(userId) as { id: number }[];
  return ids.map((r) => splitDetail(r.id)!).filter(Boolean);
}

export function contacts(userId: number) {
  return db().prepare("SELECT id, label, address, emoji FROM contacts WHERE user_id = ? ORDER BY label").all(userId) as { id: number; label: string; address: string; emoji: string }[];
}

export function blockedCount(userId: number) {
  const p = (db().prepare("SELECT COUNT(*) AS n FROM payments WHERE from_user = ? AND status = 'blocked' AND reason != 'balance'").get(userId) as { n: number }).n;
  const l = (db().prepare("SELECT COUNT(*) AS n FROM link_scans WHERE user_id = ? AND verdict = 'dangerous'").get(userId) as { n: number }).n;
  return p + l;
}

export function linkScans(userId: number) {
  return db().prepare("SELECT id, url, verdict, reasons, source, kane_url, created_at FROM link_scans WHERE user_id = ? ORDER BY id DESC LIMIT 10").all(userId) as
    { id: number; url: string; verdict: string; reasons: string; source: string; kane_url: string | null; created_at: string }[];
}
