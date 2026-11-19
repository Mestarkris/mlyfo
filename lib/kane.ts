import { spawn } from "node:child_process";

export type KaneRunEnd = {
  status: "passed" | "failed";
  summary?: string;
  duration?: number;
  final_state?: Record<string, unknown>;
  test_url?: string;
};

export type KaneOutcome =
  | { ok: true; end: KaneRunEnd; exitCode: number }
  | { ok: false; error: string; exitCode: number | null };

const BIN = process.env.KANE_CLI_BIN ?? "kane-cli";

/** Run one plain-English Kane objective in agent mode and return its run_end event. */
export function kaneRun(objective: string, opts: { timeoutS?: number; maxSteps?: number } = {}): Promise<KaneOutcome> {
  const args = ["run", objective, "--agent", "--headless", "--timeout", String(opts.timeoutS ?? 120), "--max-steps", String(opts.maxSteps ?? 15)];
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let child;
    try {
      child = spawn(BIN, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    } catch (e) {
      return resolve({ ok: false, error: String(e), exitCode: null });
    }
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e: NodeJS.ErrnoException) =>
      resolve({ ok: false, error: e.code === "ENOENT" ? "Kane CLI isn’t installed on this server." : e.message, exitCode: null }),
    );
    child.on("close", (code) => {
      const end = out
        .split("\n")
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .reverse()
        .find((e) => e && (e.type === "run_end" || e.event === "run_end" || ("status" in e && "summary" in e)));
      if (end) return resolve({ ok: true, end, exitCode: code ?? 0 });
      const why = code === 2 ? "Kane CLI isn’t logged in (run kane-cli login)." : code === 3 ? "Kane timed out." : err.trim().split("\n").pop() || "Kane returned no result.";
      resolve({ ok: false, error: why, exitCode: code });
    });
  });
}

/** Kane opens a link in a real browser and reports what the page tries to do, without entering anything. */
export async function kaneScanLink(url: string) {
  const objective =
    `Go to ${url}. Do not type into any field and do not click any button that connects a wallet or submits a form. ` +
    `Look at the page. Store 'yes' as 'asks_secret' if the page asks for a seed phrase, recovery phrase or private key, otherwise store 'no' as 'asks_secret'. ` +
    `Store 'yes' as 'asks_wallet' if the page asks to connect a crypto wallet, otherwise store 'no' as 'asks_wallet'. ` +
    `Store 'yes' as 'promises_free' if it promises free tokens, an airdrop or a giveaway, otherwise store 'no' as 'promises_free'. ` +
    `Store the page title as 'title'.`;
  const r = await kaneRun(objective, { timeoutS: 90, maxSteps: 8 });
  if (!r.ok) return { available: false as const, error: r.error };
  const s = (r.end.final_state ?? {}) as Record<string, string>;
  const yes = (k: string) => String(s[k] ?? "").toLowerCase().startsWith("y");
  const reasons: string[] = [];
  if (yes("asks_secret")) reasons.push("Kane saw the page ask for a seed phrase or private key.");
  if (yes("promises_free")) reasons.push("Kane saw the page promise free tokens or an airdrop.");
  if (yes("asks_wallet")) reasons.push("Kane saw the page ask to connect a wallet.");
  const verdict = yes("asks_secret") ? "dangerous" : yes("promises_free") && yes("asks_wallet") ? "dangerous" : reasons.length ? "risky" : "safe";
  if (!reasons.length) reasons.push(`Kane opened “${s.title ?? url}” and found no requests for secrets or wallet access.`);
  return { available: true as const, verdict, reasons, testUrl: r.end.test_url ?? null, title: s.title ?? null };
}
