import { db } from "./db";
import { isSolanaAddress } from "./crypto";
import { DEMO } from "./seed";
import type { User } from "./auth";

export type Finding = { level: "ok" | "info" | "warn" | "block"; code: string; message: string };

/** Addresses reported as drainers or scams. Real deployments would sync a feed. */
const SCAM_ADDRESSES = new Set([DEMO.scam]);

export function checkAddress(user: User, address: string): { findings: Finding[]; known: boolean; contact?: string } {
  const findings: Finding[] = [];
  const a = address.trim();
  if (!isSolanaAddress(a)) {
    return { findings: [{ level: "block", code: "invalid", message: "This isn’t a valid Solana address." }], known: false };
  }
  if (a === user.address) {
    findings.push({ level: "block", code: "self", message: "This is your own address." });
  }
  if (user.shield_scamlist && SCAM_ADDRESSES.has(a)) {
    findings.push({ level: "block", code: "scamlist", message: "This address is on Mlyfo’s scam list. Payments to it are blocked." });
  }
  const contacts = db().prepare("SELECT label, address FROM contacts WHERE user_id = ?").all(user.id) as { label: string; address: string }[];
  const exact = contacts.find((c) => c.address === a);
  if (!exact && user.shield_lookalike) {
    const twin = contacts.find((c) => c.address.slice(0, 4) === a.slice(0, 4) && c.address.slice(-4) === a.slice(-4));
    if (twin) {
      findings.push({
        level: "block", code: "lookalike",
        message: `This looks like ${twin.label}’s saved address but isn’t. The first and last 4 characters match and the middle doesn’t.`,
      });
    }
  }
  const paidBefore = (db().prepare("SELECT COUNT(*) AS n FROM payments WHERE from_user = ? AND to_address = ? AND status = 'sent'").get(user.id, a) as { n: number }).n > 0;
  if (!exact && !paidBefore && !findings.some((f) => f.level === "block")) {
    findings.push({ level: "warn", code: "new", message: "You’ve never paid this address before." });
  }
  if (findings.length === 0) findings.push({ level: "ok", code: "known", message: exact ? `Matches ${exact.label}’s saved address.` : "You’ve paid this address before." });
  return { findings, known: !!exact || paidBefore, contact: exact?.label };
}

/** Mismatch positions between an address and its look-alike contact, for highlighting. */
export function diffMask(a: string, b: string): boolean[] {
  return [...a].map((ch, i) => ch !== b[i]);
}

const TRUSTED = ["phantom.app", "solflare.com", "jup.ag", "solana.com", "mlyfo.app", "magiceden.io", "tensor.trade"];
const BAD_WORDS = ["airdrop", "claim", "verify-wallet", "walletconnect-", "seed", "recovery", "drainer", "free-sol", "giveaway"];

function lev(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Fast rules check. Kane deep scan (lib/kane.ts) opens the page in a real browser. */
export function checkLink(raw: string): { verdict: "safe" | "risky" | "dangerous"; reasons: string[]; host: string } {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return { verdict: "risky", reasons: ["This isn’t a valid link."], host: "" }; }
  const host = u.hostname.toLowerCase();
  const reasons: string[] = [];
  let score = 0;
  if (u.protocol !== "https:") { reasons.push("The link doesn’t use HTTPS."); score += 1; }
  if (host.startsWith("xn--") || host.includes(".xn--")) { reasons.push("The address uses look-alike characters (punycode)."); score += 3; }
  const base = host.split(".").slice(-2).join(".");
  if (TRUSTED.includes(base)) return { verdict: score ? "risky" : "safe", reasons: reasons.length ? reasons : [`${base} is a known, trusted site.`], host };
  for (const t of TRUSTED) {
    const d = lev(base, t);
    if (d > 0 && d <= 2) { reasons.push(`The domain looks like ${t} but isn’t.`); score += 3; }
  }
  const BRANDS = TRUSTED.map((t) => t.split(".")[0]);
  for (const part of host.split(/[.-]/)) {
    for (const b of BRANDS) {
      if (part.length < 4) continue;
      const d = lev(part, b);
      if (d > 0 && d <= 2 && !reasons.some((r) => r.includes(b))) { reasons.push(`The address imitates ${b} but isn’t the real site.`); score += 3; }
    }
  }
  const lower = (host + u.pathname).toLowerCase();
  for (const w of BAD_WORDS) if (lower.includes(w)) { reasons.push(`The link mentions “${w}”, common in wallet-drain scams.`); score += 2; break; }
  if (/\d+\.\d+\.\d+\.\d+/.test(host)) { reasons.push("The link points to a raw IP address."); score += 2; }
  if (!reasons.length) reasons.push("No known red flags. Run a deep scan to open it safely in a real browser.");
  return { verdict: score >= 3 ? "dangerous" : score >= 1 ? "risky" : "safe", reasons, host };
}
