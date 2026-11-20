#!/usr/bin/env node
// Self-heal drill: break Mlyfo on purpose, then let Kane and the coding agent heal it.
//
//   1. Plants a realistic bug: Shield's look-alike check compares the wrong last 4 characters,
//      so an address that imitates a saved contact gets through.
//   2. Runs the closed loop (scripts/loop.mjs) on the Shield test. Kane catches the bug in a
//      real browser, the failure goes to the coding agent, the agent fixes the code, Kane checks again.
//   3. Writes the story to kane/results/heal/story.json (shown on /app/verified) and puts
//      lib/shield.ts back exactly as it was in git, unless you pass --keep.
//
// Needs Mlyfo running locally in dev mode, so the agent's fix is picked up without a rebuild:
//   npm run dev            (in another terminal)
//   npm run heal           (MLYFO_AGENT_CMD picks the agent, default "claude -p --permission-mode acceptEdits")
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = process.env.MLYFO_URL ?? "http://localhost:3100";
const OUT = path.join(ROOT, "kane", "results", "heal");
const FILE = "lib/shield.ts";
const keep = process.argv.includes("--keep");

const BUG = {
  title: "Shield’s look-alike check compares the wrong last 4 characters",
  file: FILE,
  from: "c.address.slice(-4) === a.slice(-4)",
  to: "c.address.slice(-4) === a.slice(-5, -1)",
  effect: "An address that copies the first and last 4 characters of a saved contact is no longer blocked.",
  test: "03_shield_lookalike",
};

const git = (...args) => spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
const abs = path.join(ROOT, FILE);

if (/vercel\.app|mlyfo\.app/.test(BASE)) { console.error("The drill edits code, so run it against a local dev server, not production."); process.exit(2); }
try { await fetch(BASE, { signal: AbortSignal.timeout(30000) }); }
catch { console.error(`Mlyfo isn’t running at ${BASE}. Start it with: npm run dev`); process.exit(2); }
if (git("diff", "--quiet", "--", FILE).status !== 0) { console.error(`${FILE} has uncommitted changes. Commit or stash them first, so the drill can put it back.`); process.exit(2); }

const original = fs.readFileSync(abs, "utf8");
if (!original.includes(BUG.from)) { console.error(`Couldn’t find the line to break in ${FILE}. The drill needs updating.`); process.exit(2); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const startedAt = new Date().toISOString();
const broken = original.replace(BUG.from, BUG.to);
fs.writeFileSync(abs, broken);
console.log(`\n✂  Broke ${FILE} on purpose: ${BUG.title}.\n   ${BUG.effect}\n`);
await new Promise((r) => setTimeout(r, 4000)); // let the dev server recompile

const loop = spawnSync(process.execPath, [path.join(ROOT, "scripts", "loop.mjs"), BUG.test, "--web"], {
  cwd: ROOT, stdio: "inherit", env: { ...process.env, MLYFO_RESULTS: path.relative(ROOT, OUT) },
});

const after = fs.readFileSync(abs, "utf8");
const fixDiff = (() => {
  fs.writeFileSync(path.join(OUT, "broken.ts.txt"), broken);
  const d = spawnSync("git", ["diff", "--no-index", "--no-color", "-U1", path.join(OUT, "broken.ts.txt"), abs], { encoding: "utf8" }).stdout;
  fs.rmSync(path.join(OUT, "broken.ts.txt"));
  return d.split("\n").filter((l) => /^[+-](?![+-])/.test(l)).join("\n");
})();
const report = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, "latest.json"), "utf8")); } catch { return null; } })();
// Healed means Kane failed the broken build first, then passed after the agent's fix.
const caught = (report?.loop?.[0]?.failed ?? []).length > 0;
const healed = loop.status === 0 && caught;

const story = {
  startedAt, finishedAt: new Date().toISOString(), baseUrl: BASE, caught, healed,
  bug: { title: BUG.title, file: FILE, effect: BUG.effect, plantedDiff: `-${BUG.from}\n+${BUG.to}` },
  caughtBy: report?.tests.find((t) => t.file.startsWith(BUG.test))?.name ?? BUG.test,
  attempts: (report?.loop ?? []).map((l) => ({ attempt: l.attempt, failed: l.failed, fixedBy: l.fixedBy ?? null })),
  fixDiff: fixDiff || null,
};
fs.writeFileSync(path.join(OUT, "story.json"), JSON.stringify(story, null, 2));

if (!keep) {
  git("checkout", "--", FILE);
  console.log(`\n${FILE} is back to the committed version (pass --keep to keep the agent’s fix instead).`);
}
console.log(healed
  ? `\n✓ Healed. Kane caught the bug, the agent fixed it in ${story.attempts.length - 1} round(s), and Kane passed the fix.`
  : !caught ? "\n✕ Kane didn’t catch the planted bug. The Shield test needs to be stricter."
  : `\n✕ Not healed after ${story.attempts.length} attempt(s). See kane/results/heal/.`);
console.log("Story: kane/results/heal/story.json (shown on /app/verified)");
process.exit(healed ? 0 : 1);
