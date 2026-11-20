import { checkLink } from "@/lib/shield";
import { kaneScanLink } from "@/lib/kane";
import recorded from "@/lib/recorded-scans.json";
import { q } from "@/lib/db";
import { json, bad, body, withUser } from "@/lib/http";
export const maxDuration = 120;
export async function POST(req: Request) {
  return withUser(async (u) => {
    const { url = "", deep = false } = await body<{ url: string; deep: boolean }>(req);
    const rules = checkLink(url);
    if (!rules.host) return bad(rules.reasons[0]);
    const save = (verdict: string, reasons: string[], source: string, kaneUrl: string | null = null) =>
      q.run("INSERT INTO link_scans (user_id,url,verdict,reasons,source,kane_url) VALUES (?,?,?,?,?,?)", u.id, url, verdict, JSON.stringify(reasons), source, kaneUrl);
    if (!deep) { await save(rules.verdict, rules.reasons, "rules"); return json({ source: "rules", ...rules }); }
    const k = await kaneScanLink(url);
    if (!k.available) {
      // Kane can't run here (no browser on Vercel). If Kane scanned this exact link before, show that scan, marked as recorded.
      const rec = (recorded as { url: string; verdict: string; reasons: string[]; testUrl: string | null; recordedAt: string }[])
        .find((s) => s.url.replace(/\/+$/, "") === url.trim().replace(/\/+$/, ""));
      if (!rec) return json({ source: "rules", ...rules, kaneError: k.error });
      await save(rec.verdict, rec.reasons, "kane-recorded", rec.testUrl);
      return json({ source: "kane-recorded", verdict: rec.verdict, reasons: rec.reasons, host: rules.host, testUrl: rec.testUrl, recordedAt: rec.recordedAt });
    }
    const order = { safe: 0, risky: 1, dangerous: 2 } as const;
    const verdict = order[k.verdict as keyof typeof order] >= order[rules.verdict] ? k.verdict : rules.verdict;
    const reasons = [...k.reasons, ...rules.reasons.filter((r) => !r.startsWith("No known red flags"))];
    await save(verdict, reasons, "kane", k.testUrl);
    return json({ source: "kane", verdict, reasons, host: rules.host, testUrl: k.testUrl });
  });
}
