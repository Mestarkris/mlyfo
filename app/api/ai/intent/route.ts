import { readIntent, aiEnabled, MODEL } from "@/lib/ai";
import { q } from "@/lib/db";
import { json, body, withUser } from "@/lib/http";

export async function GET() {
  return json({ enabled: aiEnabled(), model: aiEnabled() ? MODEL : null });
}

export async function POST(req: Request) {
  return withUser(async (u) => {
    const { text = "", from = "me" } = await body<{ text: string; from: "me" | "them" }>(req);
    if (text.length > 600) return json({ intent: { kind: "none" }, source: "rules" });
    const contacts = (await q.all<{ handle: string }>("SELECT handle FROM users WHERE id != ? AND handle IS NOT NULL LIMIT 50", u.id)).map((c) => c.handle);
    return json(await readIntent(text, from === "them" ? "them" : "me", contacts));
  });
}
