#!/usr/bin/env node
// Combines the reports from parallel Kane jobs (one folder per test and device, each with its own
// latest.json and .ndjson log) into kane/results/latest.json, the report /app/verified reads.
//   node scripts/merge-results.mjs <folder with one subfolder per job>
// Exits 1 if any test failed, so the CI check goes red.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "kane", "results");
const src = path.resolve(process.argv[2] ?? "kane-parts");

const reports = fs.readdirSync(src, { withFileTypes: true }).filter((d) => d.isDirectory()).flatMap((d) => {
  const dir = path.join(src, d.name);
  try {
    const r = JSON.parse(fs.readFileSync(path.join(dir, "latest.json"), "utf8"));
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".ndjson"))) fs.copyFileSync(path.join(dir, f), path.join(OUT, f));
    return [r];
  } catch { console.error(`No report in ${d.name} (the job may have crashed).`); return []; }
});
if (!reports.length) { console.error("No Kane reports to merge."); process.exit(1); }

const tests = reports.flatMap((r) => r.tests)
  .sort((a, b) => a.file.localeCompare(b.file) || ((a.device ?? "web") === "web" ? -1 : 1));
const failed = tests.filter((t) => t.status !== "passed");
const report = {
  startedAt: reports.map((r) => r.startedAt).sort()[0],
  finishedAt: reports.map((r) => r.finishedAt).sort().at(-1),
  baseUrl: reports[0].baseUrl,
  total: tests.length,
  passed: tests.length - failed.length,
  phone: reports.find((r) => r.phone)?.phone,
  runner: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : undefined,
  tests,
  loop: [{ attempt: 1, failed: failed.map((t) => `${t.file}${t.device === "phone" ? " (phone)" : ""}`) }],
};
fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(report, null, 2));
console.log(`${report.passed}/${report.total} passed across ${reports.length} parallel jobs.`);
for (const t of failed) console.log(`✕ ${t.name} [${t.device ?? "web"}]: ${t.summary.split("\n")[0]}`);
process.exit(failed.length ? 1 : 0);
