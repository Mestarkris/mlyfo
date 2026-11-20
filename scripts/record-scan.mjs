#!/usr/bin/env node
// Records a real Kane deep scan of a link, so the live site can show it where Kane can't run
// (Vercel's servers have no browser for Kane). Uses the exact scan the app runs (lib/kane.ts).
//   node scripts/record-scan.mjs https://mlyfo.vercel.app/test-pages/fake-airdrop.html
// Writes lib/recorded-scans.json, replacing any earlier recording of the same link.
import fs from "node:fs";
import path from "node:path";
import { kaneScanLink } from "../lib/kane.ts";

const url = process.argv[2];
if (!url) { console.error("Usage: node scripts/record-scan.mjs <url>"); process.exit(2); }
const FILE = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "lib", "recorded-scans.json");

console.log(`Kane is opening ${url} …`);
const k = await kaneScanLink(url);
if (!k.available) { console.error(`Kane couldn't scan it: ${k.error}`); process.exit(1); }

const list = (() => { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return []; } })().filter((s) => s.url !== url);
list.push({ url, verdict: k.verdict, reasons: k.reasons, title: k.title, testUrl: k.testUrl, recordedAt: new Date().toISOString() });
fs.writeFileSync(FILE, JSON.stringify(list, null, 2) + "\n");
console.log(`${k.verdict}: ${k.reasons.join(" ")}\nSaved to lib/recorded-scans.json`);
