#!/usr/bin/env node
// The closed loop: Kane verifies, the coding agent fixes, Kane verifies again.
// Nothing ships (exit 0) until every Kane test passes or attempts run out.
//
//   MLYFO_AGENT_CMD   command that receives the fix request on stdin
//                     (default: "claude -p --permission-mode acceptEdits")
//   MLYFO_MAX_ATTEMPTS  default 3
//   MLYFO_RESULTS       results folder (default kane/results)
// Arguments are passed to verify.mjs, e.g. `npm run loop -- 03_shield --web`.
import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = process.env.MLYFO_RESULTS ? path.resolve(ROOT, process.env.MLYFO_RESULTS) : path.join(ROOT, "kane", "results");
const ARGS = process.argv.slice(2);
const MAX = Number(process.env.MLYFO_MAX_ATTEMPTS ?? 3);
const AGENT = process.env.MLYFO_AGENT_CMD ?? "claude -p --permission-mode acceptEdits";

function verify(attempt, only = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts", "verify.mjs"), ...only], {
    stdio: "inherit", env: { ...process.env, MLYFO_ATTEMPT: String(attempt) },
  });
  return r.status ?? 1;
}

function fixRequest(report) {
  const failed = report.tests.filter((t) => t.status !== "passed");
  const parts = failed.map((t) => {
    const spec = fs.readFileSync(path.join(ROOT, "kane", "tests", t.file), "utf8");
    const log = (() => { try { return fs.readFileSync(path.join(OUT, t.log ?? t.file.replace("_test.md", ".ndjson")), "utf8").split("\n").slice(-40).join("\n"); } catch { return ""; } })();
    return `## ${t.name} (${t.file}, ${t.device === "phone" ? "on a phone" : "desktop browser"})\nKane result: ${t.summary}\nFailed step: ${t.failedStep ?? "unknown"}\nEvidence: ${t.testUrl ?? "none"}\n\nTest:\n${spec}\n\nLast Kane events:\n${log}`;
  });
  return `You are fixing the Mlyfo app in ${ROOT} (Next.js app router, see PRODUCT.md).
Kane CLI ran these plain-English tests in a real browser and they failed.
Fix the application code so the behaviour the tests describe works for a real user.
Do not edit files in kane/tests or weaken the tests. Keep changes small. When done, reply with one line describing the fix.

${parts.join("\n\n---\n\n")}`;
}

function runAgent(prompt) {
  return new Promise((resolve) => {
    const child = spawn(AGENT, { shell: true, cwd: ROOT, stdio: ["pipe", "inherit", "inherit"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
    child.stdin.end(prompt);
  });
}

for (let attempt = 1; attempt <= MAX; attempt++) {
  console.log(`\n━━ Kane verification, attempt ${attempt} of ${MAX} ━━`);
  const code = verify(attempt, ARGS);
  if (code === 0) { console.log("\n✓ Kane approved this build. Safe to ship."); process.exit(0); }
  if (code === 2) { console.error("\nKane couldn’t run. Fix the setup above, then run npm run loop again."); process.exit(2); }

  const report = JSON.parse(fs.readFileSync(path.join(OUT, "latest.json"), "utf8"));
  const prompt = fixRequest(report);
  fs.writeFileSync(path.join(OUT, "fix-request.md"), prompt);
  if (attempt === MAX) break;

  console.log(`\n↻ Sending ${report.total - report.passed} failure(s) to the coding agent: ${AGENT}`);
  const ok = await runAgent(prompt);
  report.loop[report.loop.length - 1].fixedBy = AGENT.split(" ")[0];
  fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(report, null, 2));
  if (!ok) { console.error(`\nThe agent command failed. The fix request is in kane/results/fix-request.md.`); process.exit(1); }
  // Give the dev server a moment to recompile the agent's changes.
  await new Promise((r) => setTimeout(r, 4000));
}
console.error("\n✕ Kane still finds failures. Not shipping. See kane/results/latest.json and fix-request.md.");
process.exit(1);
