import { q } from "./db";
import { chainOf, evmChecksumOk, looksAlike, normalizeAddress, type Chain } from "./chains";
import { DEMO } from "./seed";
import type { User } from "./auth";

export type Finding = { level: "ok" | "info" | "warn" | "block"; code: string; message: string };

/** Addresses reported as drainers or scams. Real deployments would sync a feed. */
const SCAM_ADDRESSES = new Set([DEMO.scam, DEMO.scamEvm]);

export type AddressCheck = { findings: Finding[]; known: boolean; contact?: string; chain?: Chain; address?: string; twin?: string };

export async function checkAddress(user: User, address: string): Promise<AddressCheck> {
  const findings: Finding[] = [];
  const raw = address.trim();
  const chain = chainOf(raw);
  if (!chain) {
    return { findings: [{ level: "block", code: "invalid", message: "This isn’t a valid Solana, Ethereum or Base address." }], known: false };
  }
  if (chain === "evm" && !evmChecksumOk(raw)) {
    return { findings: [{ level: "block", code: "checksum", message: "This Ethereum address fails its checksum: a character was changed or mistyped." }], known: false, chain };
  }
  const a = normalizeAddress(raw);
  if (a === user.address) {
    findings.push({ level: "block", code: "self", message: "This is your own address." });
  }
  if (user.shield_scamlist && SCAM_ADDRESSES.has(a)) {
    findings.push({ level: "block", code: "scamlist", message: "This address is on Mlyfo’s scam list. Payments to it are blocked." });
  }
  const contacts = await q.all<{ label: string; address: string }>("SELECT label, address FROM contacts WHERE user_id = ?", user.id);
  const exact = contacts.find((c) => c.address === a);
  let twinAddress: string | undefined;
  if (!exact && user.shield_lookalike) {
    // Solana: same first and last 4 characters. Ethereum and Base: same 4 after "0x" and last 4, in any case.
    const twin = contacts.find((c) => chain === "evm"
      ? looksAlike(c.address, a)
      : chainOf(c.address) === "solana" && c.address.slice(0, 4) === a.slice(0, 4) && c.address.slice(-4) === a.slice(-4));
    if (twin) {
      twinAddress = twin.address;
      findings.push({
        level: "block", code: "lookalike",
        message: chain === "evm"
          ? `This looks like ${twin.label}’s saved address but isn’t. The first 4 characters after 0x and the last 4 match and the middle doesn’t.`
          : `This looks like ${twin.label}’s saved address but isn’t. The first and last 4 characters match and the middle doesn’t.`,
      });
    }
  }
  const paidBefore = Number((await q.get<{ n: number }>("SELECT COUNT(*) AS n FROM payments WHERE from_user = ? AND to_address = ? AND status = 'sent'", user.id, a))?.n ?? 0) > 0;
  if (!exact && !paidBefore && !findings.some((f) => f.level === "block")) {
    findings.push({ level: "warn", code: "new", message: "You’ve never paid this address before." });
  }
  if (findings.length === 0) findings.push({ level: "ok", code: "known", message: exact ? `Matches ${exact.label}’s saved address.` : "You’ve paid this address before." });
  return { findings, known: !!exact || paidBefore, contact: exact?.label, chain, address: a, twin: twinAddress };
}

/** Mismatch positions between an address and its look-alike contact, for highlighting. */
export function diffMask(a: string, b: string): boolean[] {
  return [...a].map((ch, i) => ch !== b[i]);
}

const TRUSTED = ["phantom.app", "solflare.com", "jup.ag", "solana.com", "mlyfo.app", "magiceden.io", "tensor.trade", "metamask.io", "uniswap.org", "coinbase.com", "etherscan.io", "basescan.org", "ethereum.org", "opensea.io"];
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
