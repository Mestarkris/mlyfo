import { db } from "@/lib/db";
import { json, bad, withUser } from "@/lib/http";
export async function POST() {
  return withUser((u) => {
    if (u.balance_cents >= 200000) return bad("Your demo balance is already over $2,000.");
    db().prepare("UPDATE users SET balance_cents = balance_cents + 10000 WHERE id = ?").run(u.id);
    return json({ ok: true, balance_cents: u.balance_cents + 10000 });
  });
}
