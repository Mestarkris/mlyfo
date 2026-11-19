import { db, tx } from "./db";
import { checkAddress, type Finding } from "./shield";
import { userById, type User } from "./auth";
import { token } from "./crypto";

export const fmt = (c: number) =>
  (c < 0 ? "−" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function spentToday(userId: number): number {
  return (db().prepare(
    "SELECT COALESCE(SUM(amount_cents),0) AS s FROM payments WHERE from_user = ? AND status = 'sent' AND date(created_at) = date('now')",
  ).get(userId) as { s: number }).s;
}

export function resolveRecipient(user: User, to: string): { address: string; label: string } | { error: string } {
  const t = to.trim().replace(/^@/, "");
  const byHandle = db().prepare("SELECT address, name FROM users WHERE handle = ?").get(t.toLowerCase()) as { address: string; name: string } | undefined;
  if (byHandle) return { address: byHandle.address, label: "@" + t.toLowerCase() };
  const contact = db().prepare("SELECT address, label FROM contacts WHERE user_id = ? AND lower(label) = lower(?)").get(user.id, t) as { address: string; label: string } | undefined;
  if (contact) return contact;
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t)) return { address: t, label: t.slice(0, 4) + "…" + t.slice(-4) };
  return { error: `No one called “${to}”. Use an @username, a saved contact or a Solana address.` };
}

export type SendResult = {
  status: "sent" | "needs_confirmation" | "blocked";
  paymentId?: number;
  findings: Finding[];
  reasons: string[];
  balance_cents?: number;
};

/**
 * The single money path. Shield runs first, then spend limits.
 * Anything over a limit is parked as needs_confirmation until the user re-enters their password.
 */
export function send(user: User, to: string, amountCents: number, opts: { note?: string; splitShareId?: number; requested?: boolean } = {}): SendResult {
  const { note = "", splitShareId, requested = false } = opts;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { status: "blocked", findings: [], reasons: ["Enter an amount above $0."] };
  const rec = resolveRecipient(user, to);
  if ("error" in rec) return { status: "blocked", findings: [], reasons: [rec.error] };
  const shield = checkAddress(user, rec.address);
  const blockers = shield.findings.filter((f) => f.level === "block");
  const ins = db().prepare(
    "INSERT INTO payments (from_user,to_address,to_user,amount_cents,note,status,reason,split_share_id) VALUES (?,?,(SELECT id FROM users WHERE address = ?),?,?,?,?,?)",
  );
  if (blockers.length) {
    const r = ins.run(user.id, rec.address, rec.address, amountCents, note, "blocked", blockers.map((b) => b.code).join(","), splitShareId ?? null);
    return { status: "blocked", paymentId: Number(r.lastInsertRowid), findings: shield.findings, reasons: blockers.map((b) => b.message) };
  }
  if (amountCents > user.balance_cents) return { status: "blocked", findings: shield.findings, reasons: [`Not enough balance. You have ${fmt(user.balance_cents)}.`] };

  const reasons: string[] = [];
  const today = spentToday(user.id);
  if (amountCents > user.per_payment_cents) reasons.push(`Over your ${fmt(user.per_payment_cents)} per-payment limit.`);
  if (today + amountCents > user.daily_limit_cents) reasons.push(`This would take you to ${fmt(today + amountCents)} today, over your ${fmt(user.daily_limit_cents)} daily limit.`);
  if (!shield.known && !requested && amountCents > user.new_recipient_cents) reasons.push(`Over your ${fmt(user.new_recipient_cents)} limit for new recipients.`);

  if (reasons.length) {
    const r = ins.run(user.id, rec.address, rec.address, amountCents, note, "needs_confirmation", reasons.join(" "), splitShareId ?? null);
    return { status: "needs_confirmation", paymentId: Number(r.lastInsertRowid), findings: shield.findings, reasons };
  }
  return settle(user.id, Number(ins.run(user.id, rec.address, rec.address, amountCents, note, "pending", "", splitShareId ?? null).lastInsertRowid), shield.findings);
}

function settle(userId: number, paymentId: number, findings: Finding[]): SendResult {
  return tx(() => {
    const p = db().prepare("SELECT * FROM payments WHERE id = ? AND from_user = ?").get(paymentId, userId) as
      { id: number; amount_cents: number; to_address: string; split_share_id: number | null } | undefined;
    if (!p) return { status: "blocked" as const, findings, reasons: ["Payment not found."] };
    const u = userById(userId)!;
    if (p.amount_cents > u.balance_cents) {
      db().prepare("UPDATE payments SET status='blocked', reason='balance' WHERE id = ?").run(p.id);
      return { status: "blocked" as const, findings, reasons: ["Not enough balance."] };
    }
    db().prepare("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?").run(p.amount_cents, userId);
    db().prepare("UPDATE users SET balance_cents = balance_cents + ? WHERE address = ?").run(p.amount_cents, p.to_address);
    db().prepare("UPDATE payments SET status='sent', created_at = datetime('now') WHERE id = ?").run(p.id);
    if (p.split_share_id) db().prepare("UPDATE split_shares SET paid_by = ?, paid_at = datetime('now') WHERE id = ? AND paid_at IS NULL").run(userId, p.split_share_id);
    return { status: "sent" as const, paymentId: p.id, findings, reasons: [], balance_cents: u.balance_cents - p.amount_cents };
  });
}

/** Confirm a parked payment. The caller has already re-checked the password. */
export function confirm(user: User, paymentId: number): SendResult {
  const p = db().prepare("SELECT status FROM payments WHERE id = ? AND from_user = ?").get(paymentId, user.id) as { status: string } | undefined;
  if (!p || p.status !== "needs_confirmation") return { status: "blocked", findings: [], reasons: ["There’s no payment waiting for confirmation."] };
  return settle(user.id, paymentId, []);
}

export function createSplit(user: User, title: string, totalCents: number, people: string[]) {
  const names = people.map((p) => p.trim()).filter(Boolean);
  const n = names.length + 1; // owner included
  if (n < 2) throw new Error("Add at least one person to split with.");
  if (n > 20) throw new Error("Splits can have up to 20 people.");
  const base = Math.floor(totalCents / n);
  const extra = totalCents - base * n; // owner absorbs rounding
  return tx(() => {
    const s = db().prepare("INSERT INTO splits (owner_id,title,total_cents) VALUES (?,?,?)").run(user.id, title || "Split", totalCents);
    const id = Number(s.lastInsertRowid);
    const ins = db().prepare("INSERT INTO split_shares (split_id,label,amount_cents,token,is_owner,paid_by,paid_at) VALUES (?,?,?,?,?,?,?)");
    ins.run(id, "You", base + extra, token(9), 1, user.id, new Date().toISOString());
    for (const name of names) ins.run(id, name.replace(/^@/, ""), base, token(9), 0, null, null);
    return id;
  });
}

export type ShareRow = { id: number; label: string; amount_cents: number; token: string; is_owner: number; paid_at: string | null; payer: string | null };
export function splitDetail(splitId: number) {
  const s = db().prepare("SELECT s.*, u.handle AS owner_handle, u.name AS owner_name, u.address AS owner_address FROM splits s JOIN users u ON u.id = s.owner_id WHERE s.id = ?").get(splitId) as
    { id: number; owner_id: number; title: string; total_cents: number; created_at: string; owner_handle: string; owner_name: string; owner_address: string } | undefined;
  if (!s) return null;
  const shares = db().prepare("SELECT sh.id, sh.label, sh.amount_cents, sh.token, sh.is_owner, sh.paid_at, u.handle AS payer FROM split_shares sh LEFT JOIN users u ON u.id = sh.paid_by WHERE sh.split_id = ? ORDER BY sh.is_owner DESC, sh.id").all(splitId) as ShareRow[];
  return { ...s, shares };
}
