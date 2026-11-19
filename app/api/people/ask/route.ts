import { q } from "@/lib/db";
import { token } from "@/lib/crypto";
import { json, bad, body, withUser } from "@/lib/http";

/** Make a private link that asks someone to confirm their wallet, so nobody has to paste an address into a chat. */
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { label = "" } = await body<{ label: string }>(req);
    const name = label.trim();
    if (!name) return bad("Who are you asking? Give them a name.");
    if (name.length > 40) return bad("Keep the name under 40 characters.");
    const t = token(9);
    await q.run("INSERT INTO address_requests (token,user_id,label) VALUES (?,?,?)", t, u.id, name);
    return json({ token: t, path: `/ask/${t}` }, 201);
  });
}
