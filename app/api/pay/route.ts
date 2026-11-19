import { send } from "@/lib/money";
import { json, body, withUser, cents } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const b = await body<Record<string, string>>(req);
    const r = send(u, String(b.to ?? ""), cents(b.amount), { note: String(b.note ?? "") });
    return json(r, r.status === "blocked" ? 422 : 200);
  });
}
