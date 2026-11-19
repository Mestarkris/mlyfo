import { after } from "next/server";
import { recordOnChain } from "@/lib/chain";
import { send } from "@/lib/money";
import { json, body, withUser, cents } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const b = await body<Record<string, string>>(req);
    const r = await send(u, String(b.to ?? ""), cents(b.amount), { note: String(b.note ?? "") });
    // Write the public Solana record after the response, so a slow network never delays the payment.
    if (r.status === "sent" && r.paymentId) { const id = r.paymentId; after(() => recordOnChain(id)); }
    return json(r, r.status === "blocked" ? 422 : 200);
  });
}
