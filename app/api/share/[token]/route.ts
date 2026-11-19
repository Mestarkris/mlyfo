import { db } from "@/lib/db";
import { send } from "@/lib/money";
import { json, bad, withUser } from "@/lib/http";
export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  return withUser((u) => {
    const sh = db().prepare("SELECT sh.id, sh.amount_cents, sh.paid_at, s.title, s.owner_id, o.handle FROM split_shares sh JOIN splits s ON s.id = sh.split_id JOIN users o ON o.id = s.owner_id WHERE sh.token = ?").get(token) as
      { id: number; amount_cents: number; paid_at: string | null; title: string; owner_id: number; handle: string } | undefined;
    if (!sh) return bad("This payment link doesn’t exist.", 404);
    if (sh.paid_at) return bad("This share has already been paid.", 409);
    if (sh.owner_id === u.id) return bad("This is your own split. Share the link with the person who owes you.");
    const r = send(u, "@" + sh.handle, sh.amount_cents, { note: sh.title, splitShareId: sh.id, requested: true });
    return json(r, r.status === "blocked" ? 422 : 200);
  });
}
