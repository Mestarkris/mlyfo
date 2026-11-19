import { db } from "@/lib/db";
import { checkPassword } from "@/lib/crypto";
import { confirm } from "@/lib/money";
import { json, bad, body, withUser } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { paymentId, password = "" } = await body<{ paymentId: number; password: string }>(req);
    const row = db().prepare("SELECT password_hash FROM users WHERE id = ?").get(u.id) as { password_hash: string };
    if (!checkPassword(password, row.password_hash)) return bad("Wrong password. The payment wasn’t sent.", 401);
    const r = confirm(u, Number(paymentId));
    return json(r, r.status === "sent" ? 200 : 422);
  });
}
