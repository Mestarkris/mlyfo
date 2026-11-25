import { checkAddress } from "@/lib/shield";
import { json, body, withUser } from "@/lib/http";

/** Checks a Solana, Ethereum or Base address. Returns the look-alike contact's address so the page can highlight what changed. */
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { address = "" } = await body<{ address: string }>(req);
    const r = await checkAddress(u, address.trim());
    return json({ ...r, twin: r.twin ?? null });
  });
}
