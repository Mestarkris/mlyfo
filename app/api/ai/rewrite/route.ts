import { rewrite, type Tone } from "@/lib/ai";
import { json, bad, body, withUser } from "@/lib/http";

export async function POST(req: Request) {
  return withUser(async () => {
    const { text = "", tone = "tidy" } = await body<{ text: string; tone: Tone }>(req);
    if (!text.trim() || text.length > 600) return bad("Type a message first.");
    const out = await rewrite(text, ["tidy", "warm", "brief"].includes(tone) ? tone : "tidy");
    if (!out) return bad("Rewrite needs the AI model. Add ANTHROPIC_API_KEY to turn it on.", 503);
    return json({ text: out });
  });
}
