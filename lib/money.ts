import { q, tx, type Q } from "./db";
import { checkAddress, type Finding } from "./shield";
import { userById, type User } from "./auth";
import { token } from "./crypto";

export const fmt = (c: number) =>
  (c < 0 ? "−" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function spentToday(userId: number, t: Q = q): Promise<number> {
  const r = await t.get<{ s: number }>(
    "SELECT COALESCE(SUM(amount_cents),0) AS s FROM payments WHERE from_user = ? AND status = 'sent' AND date(created_at) = date('now')", userId);
  return Number(r?.s ?? 0);
}

export async function resolveRecipient(user: User, to: string): Promise<{ address: string; label: string } | { error: string }> {
  const t = to.trim().replace(/^@/, "");
  const byHandle = await q.get<{ address: string; name: string }>("SELECT address, name FROM users WHERE handle = ?", t.toLowerCase());
  if (byHandle) return { address: byHandle.address, label: "@" + t.toLowerCase() };
  const contact = await q.get<{ address: string; label: string }>("SELECT address, label FROM contacts WHERE user_id = ? AND lower(label) = lower(?)", user.id, t);
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
  /** How the recipient was resolved, e.g. "@ada" or a contact name. */
  to?: string;
};

/**
 * The single money path. Shield runs first, then spend limits.
 * Anything over a limit is parked as needs_confirmation until the user re-enters their password.
 */
export async function send(user: User, to: string, amountCents: number, opts: { note?: string; splitShareId?: number; requested?: boolean } = {}): Promise<SendResult> {
  const r = await sendInner(user, to, amountCents, opts);
  if (r.to === undefined) { const rec = await resolveRecipient(user, to); if (!("error" in rec)) r.to = rec.label; }
  return r;
}

async function sendInner(user: User, to: string, amountCents: number, opts: { note?: string; splitShareId?: number; requested?: boolean }): Promise<SendResult> {
  const { note = "", splitShareId, requested = false } = opts;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { status: "blocked", findings: [], reasons: ["Enter an amount above $0."] };
  const rec = await resolveRecipient(user, to);
  if ("error" in rec) return { status: "blocked", findings: [], reasons: [rec.error] };
  const shield = await checkAddress(user, rec.address);
  const blockers = shield.findings.filter((f) => f.level === "block");
  const ins = { run: (...a: unknown[]) => q.run(
    "INSERT INTO payments (from_user,to_address,to_user,amount_cents,note,status,reason,split_share_id) VALUES (?,?,(SELECT id FROM users WHERE address = ?),?,?,?,?,?)", ...a) };
  if (blockers.length) {
    const r = await ins.run(user.id, rec.address, rec.address, amountCents, note, "blocked", blockers.map((b) => b.code).join(","), splitShareId ?? null);
    return { status: "blocked", paymentId: Number(r.lastInsertRowid), findings: shield.findings, reasons: blockers.map((b) => b.message) };
  }
  if (amountCents > user.balance_cents) return { status: "blocked", findings: shield.findings, reasons: [`Not enough balance. You have ${fmt(user.balance_cents)}.`] };

  const reasons: string[] = [];
  const today = await spentToday(user.id);
  if (amountCents > user.per_payment_cents) reasons.push(`Over your ${fmt(user.per_payment_cents)} per-payment limit.`);
  if (today + amountCents > user.daily_limit_cents) reasons.push(`This would take you to ${fmt(today + amountCents)} today, over your ${fmt(user.daily_limit_cents)} daily limit.`);
  if (!shield.known && !requested && amountCents > user.new_recipient_cents) reasons.push(`Over your ${fmt(user.new_recipient_cents)} limit for new recipients.`);

  if (reasons.length) {
    const r = await ins.run(user.id, rec.address, rec.address, amountCents, note, "needs_confirmation", reasons.join(" "), splitShareId ?? null);
    return { status: "needs_confirmation", paymentId: Number(r.lastInsertRowid), findings: shield.findings, reasons };
  }
  return settle(user.id, Number((await ins.run(user.id, rec.address, rec.address, amountCents, note, "pending", "", splitShareId ?? null)).lastInsertRowid), shield.findings);
}

async function settle(userId: number, paymentId: number, findings: Finding[]): Promise<SendResult> {
  return tx(async (t) => {
    const p = await t.get<{ id: number; amount_cents: number; to_address: string; split_share_id: number | null; status: string }>(
      "SELECT * FROM payments WHERE id = ? AND from_user = ?", paymentId, userId);
    if (!p || (p.status !== "pending" && p.status !== "needs_confirmation")) return { status: "blocked" as const, findings, reasons: ["Payment not found."] };
    const u = (await userById(userId, t))!;
    if (p.amount_cents > u.balance_cents) {
      await t.run("UPDATE payments SET status='blocked', reason='balance' WHERE id = ?", p.id);
      return { status: "blocked" as const, findings, reasons: ["Not enough balance."] };
    }
    await t.run("UPDATE users SET balance_cents = balance_cents - ? WHERE id = ?", p.amount_cents, userId);
    await t.run("UPDATE users SET balance_cents = balance_cents + ? WHERE address = ?", p.amount_cents, p.to_address);
    await t.run("UPDATE payments SET status='sent', created_at = datetime('now') WHERE id = ?", p.id);
    if (p.split_share_id) await t.run("UPDATE split_shares SET paid_by = ?, paid_at = datetime('now') WHERE id = ? AND paid_at IS NULL", userId, p.split_share_id);
    return { status: "sent" as const, paymentId: p.id, findings, reasons: [], balance_cents: u.balance_cents - p.amount_cents };
  });
}

/** Confirm a parked payment. The caller has already re-checked the password. */
export async function confirm(user: User, paymentId: number): Promise<SendResult> {
  const p = await q.get<{ status: string }>("SELECT status FROM payments WHERE id = ? AND from_user = ?", paymentId, user.id);
  if (!p || p.status !== "needs_confirmation") return { status: "blocked", findings: [], reasons: ["There’s no payment waiting for confirmation."] };
  return settle(user.id, paymentId, []);
}

export async function createSplit(user: User, title: string, totalCents: number, people: string[]) {
  const names = people.map((p) => p.trim()).filter(Boolean);
  const n = names.length + 1; // owner included
  if (n < 2) throw new Error("Add at least one person to split with.");
  if (n > 20) throw new Error("Splits can have up to 20 people.");
  const base = Math.floor(totalCents / n);
  const extra = totalCents - base * n; // owner absorbs rounding
  return tx(async (t) => {
    const s = await t.run("INSERT INTO splits (owner_id,title,total_cents) VALUES (?,?,?)", user.id, title || "Split", totalCents);
    const id = s.lastInsertRowid;
    const SH = "INSERT INTO split_shares (split_id,label,amount_cents,token,is_owner,paid_by,paid_at) VALUES (?,?,?,?,?,?,?)";
    await t.run(SH, id, "You", base + extra, token(9), 1, user.id, new Date().toISOString());
    for (const name of names) await t.run(SH, id, name.replace(/^@/, ""), base, token(9), 0, null, null);
    return id;
  });
}

export type ShareRow = { id: number; label: string; amount_cents: number; token: string; is_owner: number; paid_at: string | null; payer: string | null };
export async function splitDetail(splitId: number) {
  const s = await q.get<{ id: number; owner_id: number; title: string; total_cents: number; created_at: string; owner_handle: string; owner_name: string; owner_address: string }>(
    "SELECT s.*, u.handle AS owner_handle, u.name AS owner_name, u.address AS owner_address FROM splits s JOIN users u ON u.id = s.owner_id WHERE s.id = ?", splitId);
  if (!s) return null;
  const shares = await q.all<ShareRow>("SELECT sh.id, sh.label, sh.amount_cents, sh.token, sh.is_owner, sh.paid_at, u.handle AS payer FROM split_shares sh LEFT JOIN users u ON u.id = sh.paid_by WHERE sh.split_id = ? ORDER BY sh.is_owner DESC, sh.id", splitId);
  return { ...s, shares };
}
