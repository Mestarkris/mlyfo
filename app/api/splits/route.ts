import { createSplit, splitDetail } from "@/lib/money";
import { json, bad, body, withUser, cents } from "@/lib/http";
export async function POST(req: Request) {
  return withUser(async (u) => {
    const b = await body<{ title?: string; total?: string; people?: string[] }>(req);
    const total = cents(b.total);
    if (!Number.isFinite(total) || total < 100) return bad("Enter a total of at least $1.");
    try {
      const id = createSplit(u, String(b.title ?? "").slice(0, 60), total, Array.isArray(b.people) ? b.people.slice(0, 19) : []);
      return json(splitDetail(id), 201);
    } catch (e) { return bad((e as Error).message); }
  });
}
