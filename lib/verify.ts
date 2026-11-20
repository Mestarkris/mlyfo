import fs from "node:fs";
import path from "node:path";

export type Device = "web" | "phone";
export type KaneTest = { name: string; file: string; device?: Device; deviceName?: string; status: "passed" | "failed" | "error"; summary: string; duration?: number; testUrl?: string | null; log?: string; attempt: number };
export type KaneReport = { startedAt: string; finishedAt: string; baseUrl: string; total: number; passed: number; phone?: { name: string; width: number; height: number }; tests: KaneTest[]; loop: { attempt: number; failed: string[]; fixedBy?: string }[] };

/** One row per test file, with its desktop and phone results side by side. */
export function byTest(r: KaneReport) {
  const rows = new Map<string, { name: string; file: string; web?: KaneTest; phone?: KaneTest }>();
  for (const t of r.tests) {
    const row = rows.get(t.file) ?? { name: t.name, file: t.file };
    row[t.device ?? "web"] = t;
    rows.set(t.file, row);
  }
  return [...rows.values()];
}

export function score(r: KaneReport, device: Device) {
  const ts = r.tests.filter((t) => (t.device ?? "web") === device);
  return { passed: ts.filter((t) => t.status === "passed").length, total: ts.length };
}

export function readResults(): KaneReport | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "kane", "results", "latest.json"), "utf8")); } catch { return null; }
}

export type HealStory = {
  startedAt: string; finishedAt: string; baseUrl: string; caught: boolean; healed: boolean;
  bug: { title: string; file: string; effect: string; plantedDiff: string };
  caughtBy: string; attempts: { attempt: number; failed: string[]; fixedBy: string | null }[]; fixDiff: string | null;
};

export function readHeal(): HealStory | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "kane", "results", "heal", "story.json"), "utf8")); } catch { return null; }
}
