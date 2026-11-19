import { q } from "@/lib/db";
import { checkPassword } from "@/lib/crypto";
import { confirm } from "@/lib/money";
import { json, bad, body, withUser } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { paymentId, password = "" } = await body<{ paymentId: number; password: string }>(req);
    const row = (await q.get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", u.id))!;
    if (!checkPassword(password, row.password_hash)) return bad("Wrong password. The payment wasn’t sent.", 401);
    const r = await confirm(u, Number(paymentId));
    return json(r, r.status === "sent" ? 200 : 422);
  });
}
