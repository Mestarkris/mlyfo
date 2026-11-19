#!/usr/bin/env node
// Runs every plain-English test in kane/tests with Kane CLI against a running Mlyfo,
// then writes kane/results/latest.json (shown in the app at /app/verified).
// Exit codes: 0 all passed, 1 a test failed, 2 Kane CLI missing or not logged in.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TESTS = path.join(ROOT, "kane", "tests");
const OUT = path.join(ROOT, "kane", "results");
const BASE = process.env.MLYFO_URL ?? "http://localhost:3100";
const BIN = process.env.KANE_CLI_BIN ?? "kane-cli";
const only = process.argv.slice(2);
const attempt = Number(process.env.MLYFO_ATTEMPT ?? 1);
const runId = Date.now().toString(36).slice(-6);

function parseTest(file) {
  const raw = fs.readFileSync(path.join(TESTS, file), "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const name = fm?.[1].match(/name:\s*(.+)/)?.[1].trim() ?? file;
  const steps = raw.slice(fm ? fm[0].length : 0).split("\n").map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replaceAll("{{baseUrl}}", BASE).replaceAll("{{runId}}", runId));
  return { file, name, steps };
}

function runKane(objective, logFile) {
  return new Promise((resolve) => {
    const args = ["run", objective, "--agent", "--headless", "--max-steps", "25", "--timeout", "240"];
    const child = spawn(BIN, args, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    const log = fs.createWriteStream(logFile);
    let out = "";
    // Kane's own --timeout doesn't always fire if the browser hangs, so enforce a hard limit.
    const killer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 900_000);
    child.on("close", () => clearTimeout(killer));
    child.stdout.on("data", (d) => { out += d; log.write(d); });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("error", (e) => resolve({ code: 2, error: e.code === "ENOENT" ? `${BIN} not found. Install it with: npm install -g @testmuai/kane-cli` : e.message }));
    child.on("close", (code) => {
      log.end();
      const events = out.split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const end = [...events].reverse().find((e) => e.type === "run_end" || e.event === "run_end" || ("status" in e && "summary" in e && !("step" in e)));
      const failedStep = events.filter((e) => e.status === "failed" && e.step).pop();
      resolve({ code: code ?? 3, end, failedStep });
    });
  });
}

const files = fs.readdirSync(TESTS).filter((f) => f.endsWith("_test.md")).filter((f) => !only.length || only.some((o) => f.includes(o))).sort();
if (!files.length) { console.error("No tests found."); process.exit(1); }

try { await fetch(BASE, { signal: AbortSignal.timeout(60000) }); }
catch { console.error(`Mlyfo isn’t running at ${BASE}. Start it with: npm run dev`); process.exit(2); }

fs.mkdirSync(OUT, { recursive: true });
const startedAt = new Date().toISOString();
const results = [];
for (const f of files) {
  const t = parseTest(f);
  // One Kane objective per test file, steps in order.
  const objective = t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  process.stdout.write(`▶ ${t.name} … `);
  const r = await runKane(objective, path.join(OUT, f.replace("_test.md", ".ndjson")));
  if (r.code === 2 && !r.end) {
    console.log("error");
    console.error(r.error ?? "Kane CLI couldn’t start. Run kane-cli login, then try again.");
    process.exit(2);
  }
  const status = r.end?.status === "passed" && r.code === 0 ? "passed" : "failed";
  const summary = r.end?.summary ?? r.failedStep?.step ?? (r.code === 3 ? "Kane timed out." : "Kane returned no result.");
  console.log(status === "passed" ? "✓ passed" : `✕ failed: ${summary}`);
  results.push({ name: t.name, file: f, status, summary, duration: r.end?.duration, testUrl: r.end?.test_url ?? null, attempt, failedStep: r.failedStep?.step ?? null });
}

const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "latest.json"), "utf8")); } catch { return null; } })();
const failed = results.filter((r) => r.status !== "passed").map((r) => r.file);
const loop = attempt > 1 && prev?.loop ? [...prev.loop, { attempt, failed }] : [{ attempt, failed }];
const report = { startedAt, finishedAt: new Date().toISOString(), baseUrl: BASE, total: results.length, passed: results.length - failed.length, tests: results, loop };
fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(report, null, 2));
console.log(`\n${report.passed}/${report.total} passed. Report: kane/results/latest.json`);
process.exit(failed.length ? 1 : 0);
