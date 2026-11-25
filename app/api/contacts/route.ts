import { q } from "@/lib/db";
import { chainOf, normalizeAddress } from "@/lib/chains";
import { checkAddress } from "@/lib/shield";
import { json, bad, body, withUser } from "@/lib/http";

/**
 * Save a person. Either { handle: "@ada" } for someone on Mlyfo, or { label, address } for any wallet.
 * Shield runs before anything is saved: a contact is trusted from then on, so a bad address must never get in.
 */
export async function POST(req: Request) {
  return withUser(async (u) => {
    const b = await body<Record<string, string>>(req);
    let label = (b.label ?? "").trim();
    let address = (b.address ?? "").trim();
    let source = "saved";
    const handle = (b.handle ?? "").trim().replace(/^@/, "").toLowerCase();
    if (handle) {
      const other = await q.get<{ name: string; address: string; id: number }>("SELECT id, name, address FROM users WHERE handle = ?", handle);
      if (!other) return bad(`There’s no Mlyfo user called @${handle}.`, 404);
      if (other.id === u.id) return bad("That’s you.");
      address = other.address; label ||= other.name.split(" ")[0]; source = "mlyfo";
    }
    if (!label) return bad("Give this person a name.");
    if (!chainOf(address)) return bad("That isn’t a valid Solana, Ethereum or Base address.");
    address = normalizeAddress(address);
    const clash = await q.get<{ address: string }>("SELECT address FROM contacts WHERE user_id = ? AND lower(label) = lower(?)", u.id, label);
    if (clash && clash.address !== address) return bad(`You already have a contact called ${label}. Use a different name.`, 409);
    const shield = await checkAddress(u, address);
    const block = shield.findings.find((f) => f.level === "block");
    if (block) return json({ error: `Not saved. ${block.message}`, code: block.code }, 422);
    try {
      await q.run("INSERT INTO contacts (user_id,label,address,source,created_at) VALUES (?,?,?,?,datetime('now'))", u.id, label, address, source);
    } catch { return bad("You’ve already saved this address.", 409); }
    return json({ ok: true, label }, 201);
  });
}

export async function DELETE(req: Request) {
  return withUser(async (u) => {
    const id = Number(new URL(req.url).searchParams.get("id"));
    await q.run("DELETE FROM contacts WHERE id = ? AND user_id = ?", id, u.id);
    return json({ ok: true });
  });
}
