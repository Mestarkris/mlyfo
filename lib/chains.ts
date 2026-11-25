import { keccak_256 } from "@noble/hashes/sha3";

/**
 * Which chain an address belongs to. Solana addresses are base58; Ethereum and Base share
 * the same 0x format, so one EVM address works on both.
 */
export type Chain = "solana" | "evm";

export const CHAIN_NAME: Record<Chain, string> = { solana: "Solana", evm: "Ethereum and Base" };

const SOLANA = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM = /^0x[0-9a-fA-F]{40}$/;

export function chainOf(a: string): Chain | null {
  if (EVM.test(a)) return "evm";
  if (SOLANA.test(a)) return "solana";
  return null;
}

/** EIP-55: the capital letters in an Ethereum address are a checksum of the address itself. */
export function toChecksumAddress(a: string): string {
  const hex = a.slice(2).toLowerCase();
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(hex))).toString("hex");
  let out = "0x";
  for (let i = 0; i < 40; i++) out += parseInt(hash[i], 16) >= 8 ? hex[i].toUpperCase() : hex[i];
  return out;
}

/** All lower or all upper case carries no checksum. Mixed case must match it exactly, or a character was changed. */
export function evmChecksumOk(a: string): boolean {
  const body = a.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(a) === a;
}

/** One spelling per address, so saved and pasted copies compare equal. */
export function normalizeAddress(a: string): string {
  const t = a.trim();
  return chainOf(t) === "evm" ? toChecksumAddress(t) : t;
}

/**
 * Address poisoning copies the start and the end of an address you know. For Solana that's the
 * first and last 4 characters; for Ethereum and Base the 4 after "0x" and the last 4, in any case.
 */
export function looksAlike(a: string, b: string): boolean {
  const ca = chainOf(a), cb = chainOf(b);
  if (!ca || ca !== cb || a === b) return false;
  if (ca === "evm") {
    const x = a.toLowerCase(), y = b.toLowerCase();
    return x !== y && x.slice(2, 6) === y.slice(2, 6) && x.slice(-4) === y.slice(-4);
  }
  return a.slice(0, 4) === b.slice(0, 4) && a.slice(-4) === b.slice(-4);
}
