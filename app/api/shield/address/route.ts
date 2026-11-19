import { checkAddress } from "@/lib/shield";
import { db } from "@/lib/db";
import { json, body, withUser } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { address = "" } = await body<{ address: string }>(req);
    const r = checkAddress(u, address.trim());
    const twinCode = r.findings.find((f) => f.code === "lookalike");
    let twin: string | null = null;
    if (twinCode) {
      const a = address.trim();
      const c = db().prepare("SELECT address FROM contacts WHERE user_id = ? AND substr(address,1,4) = ? AND substr(address,-4) = ?").get(u.id, a.slice(0, 4), a.slice(-4)) as { address: string } | undefined;
      twin = c?.address ?? null;
    }
    return json({ ...r, twin });
  });
}
