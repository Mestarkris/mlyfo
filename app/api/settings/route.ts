import { db } from "@/lib/db";
import { json, bad, body, withUser, cents } from "@/lib/http";

const LIMITS = { daily: "daily_limit_cents", perPayment: "per_payment_cents", newRecipient: "new_recipient_cents" } as const;
const SHIELD = { lookalike: "shield_lookalike", scamlist: "shield_scamlist", links: "shield_links" } as const;

export async function PATCH(req: Request) {
  return withUser(async (u) => {
    const b = await body(req);
    const d = db();
    for (const [k, col] of Object.entries(LIMITS)) {
      if (b[k] === undefined) continue;
      const c = cents(b[k]);
      if (!Number.isFinite(c) || c < 100 || c > 10_000_000) return bad("Limits must be between $1 and $100,000.");
      d.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(c, u.id);
    }
    for (const [k, col] of Object.entries(SHIELD)) {
      if (typeof b[k] === "boolean") d.prepare(`UPDATE users SET ${col} = ? WHERE id = ?`).run(b[k] ? 1 : 0, u.id);
    }
    return json({ ok: true });
  });
}
