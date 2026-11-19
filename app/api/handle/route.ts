import { q } from "@/lib/db";
import { json } from "@/lib/http";
export async function GET(req: Request) {
  const h = (new URL(req.url).searchParams.get("h") ?? "").replace(/^@/, "").toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(h)) return json({ valid: false, free: false });
  return json({ valid: true, free: !(await q.get("SELECT 1 AS x FROM users WHERE handle = ?", h)) });
}
