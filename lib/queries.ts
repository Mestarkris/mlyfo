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
