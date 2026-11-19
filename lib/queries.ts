import { q } from "./db";
import { splitDetail } from "./money";

export type Activity = { id: number; kind: "out" | "in"; amount_cents: number; status: string; reason: string; note: string; created_at: string; other: string; emoji: string };

export async function activity(userId: number, limit = 8): Promise<Activity[]> {
  return q.all<Activity>(`
    SELECT p.id, CASE WHEN p.from_user = ? THEN 'out' ELSE 'in' END AS kind, p.amount_cents, p.status, p.reason, p.note, p.created_at,
      CASE WHEN p.from_user = ?
        THEN COALESCE((SELECT label FROM contacts c WHERE c.user_id = ? AND c.address = p.to_address), (SELECT '@'||handle FROM users WHERE id = p.to_user), substr(p.to_address,1,4)||'…'||substr(p.to_address,-4))
        ELSE (SELECT '@'||handle FROM users WHERE id = p.from_user) END AS other,
      COALESCE((SELECT emoji FROM contacts c WHERE c.user_id = ? AND c.address = p.to_address AND p.from_user = ?), CASE WHEN p.from_user = ? THEN '↗' ELSE '↙' END) AS emoji
    FROM payments p
    WHERE (p.from_user = ? OR (p.to_user = ? AND p.status = 'sent')) AND p.status != 'pending'
    ORDER BY p.id DESC LIMIT ?`, userId, userId, userId, userId, userId, userId, userId, userId, limit);
}

export async function pendingConfirmations(userId: number) {
  return (await activity(userId, 50)).filter((a) => a.kind === "out" && a.status === "needs_confirmation");
}

export async function splitsFor(userId: number) {
  const ids = await q.all<{ id: number }>("SELECT id FROM splits WHERE owner_id = ? ORDER BY id DESC", userId);
  const all = await Promise.all(ids.map((r) => splitDetail(r.id)));
  return all.filter((s): s is NonNullable<typeof s> => !!s);
}

export async function contacts(userId: number) {
  return q.all<{ id: number; label: string; address: string; emoji: string }>("SELECT id, label, address, emoji FROM contacts WHERE user_id = ? ORDER BY label", userId);
}

export async function blockedCount(userId: number) {
  const [p, l] = await Promise.all([
    q.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE from_user = ? AND status = 'blocked' AND reason != 'balance'", userId),
    q.get<{ n: number }>("SELECT COUNT(*) AS n FROM link_scans WHERE user_id = ? AND verdict = 'dangerous'", userId),
  ]);
  return Number(p?.n ?? 0) + Number(l?.n ?? 0);
}

export async function linkScans(userId: number) {
  return q.all<{ id: number; url: string; verdict: string; reasons: string; source: string; kane_url: string | null; created_at: string }>(
    "SELECT id, url, verdict, reasons, source, kane_url, created_at FROM link_scans WHERE user_id = ? ORDER BY id DESC LIMIT 10", userId);
}

export type Person = {
  id: number; label: string; address: string; source: string; created_at: string | null;
  handle: string | null; changed_days: number | null; paid_count: number; last_paid: string | null;
};

/** Saved people with how Mlyfo knows their address, for the trust label. */
export async function people(userId: number): Promise<Person[]> {
  return q.all<Person>(`
    SELECT c.id, c.label, c.address, c.source, c.created_at, u.handle,
      CASE WHEN u.address_changed_at > datetime('now','-7 days') THEN CAST(julianday('now') - julianday(u.address_changed_at) AS INTEGER) END AS changed_days,
      (SELECT COUNT(*) FROM payments p WHERE p.from_user = c.user_id AND p.to_address = c.address AND p.status = 'sent') AS paid_count,
      (SELECT MAX(created_at) FROM payments p WHERE p.from_user = c.user_id AND p.to_address = c.address AND p.status = 'sent') AS last_paid
    FROM contacts c LEFT JOIN users u ON u.address = c.address
    WHERE c.user_id = ? ORDER BY lower(c.label)`, userId);
}

export async function openAsks(userId: number) {
  return q.all<{ token: string; label: string; created_at: string }>(
    "SELECT token, label, created_at FROM address_requests WHERE user_id = ? AND fulfilled_at IS NULL ORDER BY created_at DESC LIMIT 10", userId);
}
