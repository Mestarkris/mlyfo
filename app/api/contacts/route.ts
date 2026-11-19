import { db } from "@/lib/db";
import { isSolanaAddress } from "@/lib/crypto";
import { json, bad, body, withUser } from "@/lib/http";

export async function POST(req: Request) {
  return withUser(async (u) => {
    const { label = "", address = "", emoji = "🙂" } = await body<Record<string, string>>(req);
    if (!label.trim()) return bad("Give this contact a name.");
    if (!isSolanaAddress(address.trim())) return bad("That isn’t a valid Solana address.");
    try {
      db().prepare("INSERT INTO contacts (user_id,label,address,emoji) VALUES (?,?,?,?)").run(u.id, label.trim(), address.trim(), emoji);
    } catch { return bad("You’ve already saved this address.", 409); }
    return json({ ok: true }, 201);
  });
}
export async function DELETE(req: Request) {
  return withUser((u) => {
    const id = Number(new URL(req.url).searchParams.get("id"));
    db().prepare("DELETE FROM contacts WHERE id = ? AND user_id = ?").run(id, u.id);
    return json({ ok: true });
  });
}
