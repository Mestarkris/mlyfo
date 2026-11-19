import { q, tx } from "@/lib/db";
import { json, bad, withUser } from "@/lib/http";

/** The person who opened the link confirms their wallet. It lands in the asker's contacts as confirmed by them. */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withUser(async (me) => {
    const r = await q.get<{ user_id: number; label: string; fulfilled_at: string | null }>("SELECT user_id, label, fulfilled_at FROM address_requests WHERE token = ?", token);
    if (!r) return bad("This link doesn’t exist.", 404);
    if (r.fulfilled_at) return bad("This link has already been used.", 409);
    if (r.user_id === me.id) return bad("This is your own link. Send it to the person you want to pay.");
    await tx(async (t) => {
      // Same person already saved under this name or this address: upgrade it to confirmed with their real wallet.
      const existing = await t.get<{ id: number }>("SELECT id FROM contacts WHERE user_id = ? AND (lower(label) = lower(?) OR address = ?)", r.user_id, r.label, me.address);
      if (existing) await t.run("UPDATE contacts SET label = ?, address = ?, source = 'confirmed' WHERE id = ?", r.label, me.address, existing.id);
      else await t.run("INSERT INTO contacts (user_id,label,address,source,created_at) VALUES (?,?,?,'confirmed',datetime('now'))", r.user_id, r.label, me.address);
      await t.run("UPDATE address_requests SET fulfilled_by = ?, fulfilled_at = datetime('now') WHERE token = ?", me.id, token);
    });
    return json({ ok: true });
  });
}
