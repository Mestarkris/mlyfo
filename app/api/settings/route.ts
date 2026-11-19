import { q } from "@/lib/db";
import { json, bad, body, withUser, cents } from "@/lib/http";
import { isSolanaAddress } from "@/lib/crypto";
import { checkAddress } from "@/lib/shield";

const LIMITS = { daily: "daily_limit_cents", perPayment: "per_payment_cents", newRecipient: "new_recipient_cents" } as const;
const SHIELD = { lookalike: "shield_lookalike", scamlist: "shield_scamlist", links: "shield_links" } as const;

export async function PATCH(req: Request) {
  return withUser(async (u) => {
    const b = await body(req);
    for (const [k, col] of Object.entries(LIMITS)) {
      if (b[k] === undefined) continue;
      const c = cents(b[k]);
      if (!Number.isFinite(c) || c < 100 || c > 10_000_000) return bad("Limits must be between $1 and $100,000.");
      await q.run(`UPDATE users SET ${col} = ? WHERE id = ?`, c, u.id);
    }
    for (const [k, col] of Object.entries(SHIELD)) {
      if (typeof b[k] === "boolean") await q.run(`UPDATE users SET ${col} = ? WHERE id = ?`, b[k] ? 1 : 0, u.id);
    }
    if (typeof b.address === "string" && b.address.trim() !== u.address) {
      const a = b.address.trim();
      if (!isSolanaAddress(a)) return bad("That isn’t a valid Solana address.");
      const scam = (await checkAddress(u, a)).findings.find((f) => f.code === "scamlist");
      if (scam) return bad(scam.message);
      // Friends paying you see a warning for 7 days after this, in case the change wasn't you.
      try { await q.run("UPDATE users SET address = ?, address_changed_at = datetime('now') WHERE id = ?", a, u.id); }
      catch { return bad("Another account already uses that wallet.", 409); }
    }
    return json({ ok: true });
  });
}
