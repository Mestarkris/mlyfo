#!/usr/bin/env node
// Runs every plain-English test in kane/tests with Kane CLI against a running Mlyfo,
// then writes kane/results/latest.json (shown in the app at /app/verified).
// Each test runs in desktop Chrome, and also on a phone if its front matter says `devices: [web, phone]`.
//   npm run verify                 every test on every device it lists
//   npm run verify -- --phone      only the phone runs (--web: only desktop); add a name to pick tests
// A partial run keeps the other results from the last report against the same URL.
// Exit codes: 0 all passed, 1 a test failed, 2 Kane CLI missing or not logged in.
import { spawn } from "node:child_process";
import { startPhone, PHONE } from "./phone-relay.mjs";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TESTS = path.join(ROOT, "kane", "tests");
const OUT = process.env.MLYFO_RESULTS ? path.resolve(ROOT, process.env.MLYFO_RESULTS) : path.join(ROOT, "kane", "results");
const BASE = process.env.MLYFO_URL ?? "http://localhost:3100";
const BIN = process.env.KANE_CLI_BIN ?? "kane-cli";
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const pick = ["web", "phone"].filter((d) => args.includes(`--${d}`));
const wanted = pick.length ? pick : ["web", "phone"];
const attempt = Number(process.env.MLYFO_ATTEMPT ?? 1);
const runId = Date.now().toString(36).slice(-6);

function parseTest(file) {
  const raw = fs.readFileSync(path.join(TESTS, file), "utf8");
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/);
  const name = fm?.[1].match(/name:\s*(.+)/)?.[1].trim() ?? file;
  const devices = fm?.[1].match(/devices:\s*\[([^\]]*)\]/)?.[1].split(",").map((d) => d.trim()).filter(Boolean) ?? ["web"];
  const steps = raw.slice(fm ? fm[0].length : 0).split("\n").map((s) => s.trim()).filter(Boolean)
    .map((s) => s.replaceAll("{{baseUrl}}", BASE).replaceAll("{{runId}}", runId));
  return { file, name, devices, steps };
}

function runKane(objective, logFile, cdp) {
  return new Promise((resolve) => {
    const args = ["run", objective, "--agent", "--max-steps", "25", "--timeout", "240", ...(cdp ? ["--cdp-endpoint", cdp] : ["--headless"])];
    const child = spawn(BIN, args, { stdio: ["ignore", "pipe", "pipe"], detached: true });
    const log = fs.createWriteStream(logFile);
    let out = "";
    // Kane's own --timeout doesn't always fire if the browser hangs, so enforce a hard limit.
    const killer = setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, cdp ? 1_500_000 : 900_000); // phone runs are slower: allow 25 min
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
const runs = files.flatMap((f) => { const t = parseTest(f); return t.devices.filter((d) => wanted.includes(d)).map((device) => ({ t, device })); });
if (!runs.length) { console.error("No tests match those devices."); process.exit(1); }
for (const { t, device } of runs) {
  const f = t.file;
  // One Kane objective per test file, steps in order.
  const objective = t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  const logName = f.replace("_test.md", device === "phone" ? ".phone.ndjson" : ".ndjson");
  process.stdout.write(`▶ ${t.name} [${device}] … `);
  // Every phone run gets a fresh phone-shaped browser (no cookies carried over between tests).
  let phone = null;
  if (device === "phone") {
    try { phone = await startPhone(); }
    catch (e) { console.log("error"); console.error(e.message); process.exit(2); }
  }
  const r = await runKane(objective, path.join(OUT, logName), phone?.endpoint);
  await phone?.close();
  if (r.code === 2 && !r.end) {
    console.log("error");
    console.error(r.error ?? "Kane CLI couldn’t start. Run kane-cli login, then try again.");
    process.exit(2);
  }
  const status = r.end?.status === "passed" && r.code === 0 ? "passed" : "failed";
  const summary = r.end?.summary ?? r.failedStep?.step ?? (r.code === 3 ? "Kane timed out." : "Kane returned no result.");
  console.log(status === "passed" ? "✓ passed" : `✕ failed: ${summary}`);
  results.push({ name: t.name, file: f, device, deviceName: device === "phone" ? PHONE.name : "Desktop Chrome", log: logName, status, summary, duration: r.end?.duration, testUrl: r.end?.test_url ?? null, attempt, failedStep: r.failedStep?.step ?? null });
}

const prev = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "latest.json"), "utf8")); } catch { return null; } })();
const failed = results.filter((r) => r.status !== "passed").map((r) => `${r.file}${r.device === "phone" ? " (phone)" : ""}`);
const loop = attempt > 1 && prev?.loop ? [...prev.loop, { attempt, failed }] : [{ attempt, failed }];
// Partial run against the same site: keep the results we didn't re-run.
const key = (r) => `${r.file}|${r.device ?? "web"}`;
const ran = new Set(results.map(key));
const kept = (only.length || pick.length) && prev?.baseUrl === BASE ? prev.tests.filter((r) => !ran.has(key(r))).map((r) => ({ device: "web", deviceName: "Desktop Chrome", ...r })) : [];
const all = [...kept, ...results].sort((a, b) => a.file.localeCompare(b.file) || (a.device === "web" ? -1 : 1));
const allFailed = all.filter((r) => r.status !== "passed").length;
const report = { startedAt, finishedAt: new Date().toISOString(), baseUrl: BASE, total: all.length, passed: all.length - allFailed, phone: PHONE, tests: all, loop };
fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(report, null, 2));
console.log(`\nThis run: ${results.length - failed.length}/${results.length} passed. Report (${report.passed}/${report.total} overall): kane/results/latest.json`);
process.exit(failed.length ? 1 : 0);
