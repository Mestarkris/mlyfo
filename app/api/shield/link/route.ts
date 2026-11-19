import { checkLink } from "@/lib/shield";
import { kaneScanLink } from "@/lib/kane";
import { db } from "@/lib/db";
import { json, bad, body, withUser } from "@/lib/http";
export const maxDuration = 120;
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { url = "", deep = false } = await body<{ url: string; deep: boolean }>(req);
    const rules = checkLink(url);
    if (!rules.host) return bad(rules.reasons[0]);
    const save = (verdict: string, reasons: string[], source: string, kaneUrl: string | null = null) =>
      db().prepare("INSERT INTO link_scans (user_id,url,verdict,reasons,source,kane_url) VALUES (?,?,?,?,?,?)").run(u.id, url, verdict, JSON.stringify(reasons), source, kaneUrl);
    if (!deep) { save(rules.verdict, rules.reasons, "rules"); return json({ source: "rules", ...rules }); }
    const k = await kaneScanLink(url);
    if (!k.available) return json({ source: "rules", ...rules, kaneError: k.error });
    const order = { safe: 0, risky: 1, dangerous: 2 } as const;
    const verdict = order[k.verdict as keyof typeof order] >= order[rules.verdict] ? k.verdict : rules.verdict;
    const reasons = [...k.reasons, ...rules.reasons.filter((r) => !r.startsWith("No known red flags"))];
    save(verdict, reasons, "kane", k.testUrl);
    return json({ source: "kane", verdict, reasons, host: rules.host, testUrl: k.testUrl });
  });
}
