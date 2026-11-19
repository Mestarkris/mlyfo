import fs from "node:fs";
import path from "node:path";

export type KaneTest = { name: string; file: string; status: "passed" | "failed" | "error"; summary: string; duration?: number; testUrl?: string | null; attempt: number };
export type KaneReport = { startedAt: string; finishedAt: string; baseUrl: string; total: number; passed: number; tests: KaneTest[]; loop: { attempt: number; failed: string[]; fixedBy?: string }[] };

export function readResults(): KaneReport | null {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), "kane", "results", "latest.json"), "utf8")); } catch { return null; }
}
