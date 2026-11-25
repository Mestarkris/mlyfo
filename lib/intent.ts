/** Turns what someone types in the Mlyfo Pad into an action. Shared by client and server. */
export type Intent =
  | { kind: "split"; totalCents: number; people: number; names: string[] }
  | { kind: "pay"; amountCents: number; to: string; note: string }
  | { kind: "request"; amountCents: number }
  | { kind: "address"; address: string }
  | { kind: "link"; url: string }
  | { kind: "price"; symbol: string }
  | { kind: "none" };

const money = (s: string) => Math.round(parseFloat(s.replace(/[,$]/g, "")) * 100);
const ADDR = /\b0x[0-9a-fA-F]{40}\b|\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

export function parseIntent(text: string): Intent {
  const t = text.trim();
  if (!t) return { kind: "none" };

  const url = t.match(/https?:\/\/[^\s]+/i);
  if (url) return { kind: "link", url: url[0] };

  // "split 236 / 4", "split $236 with @kabir @zoya", "bill was $236 for 4 of us"
  let m = t.match(/split\s+\$?([\d,.]+)\s*(?:\/|ways?|by|between|among)?\s*(\d+)?/i);
  const handles = [...t.matchAll(/@([a-z0-9_]{2,20})/gi)].map((x) => x[1].toLowerCase());
  if (m) {
    const people = handles.length ? handles.length + 1 : Number(m[2] || 2);
    return { kind: "split", totalCents: money(m[1]), people, names: handles };
  }
  // "split bill with kabir @ $50", "split the bill with @ada and @kabir for $90"
  m = t.match(/split(?:\s+(?:the|this|our))?(?:\s+bill)?\s+(?:with|between)\s+(.+?)\s*(?:@|for|of|:)?\s*\$\s?([\d,.]+)/i);
  if (m) {
    const names = m[1].split(/\s*(?:,|&|\band\b)\s*|\s+/i).map((x) => x.replace(/^@/, "").toLowerCase()).filter((x) => /^[a-z0-9_]{2,20}$/.test(x) && x !== "me");
    if (names.length) return { kind: "split", totalCents: money(m[2]), people: names.length + 1, names };
  }
  m = t.match(/\$([\d,.]+)\s+for\s+(\d+)\s+of\s+us/i);
  if (m) return { kind: "split", totalCents: money(m[1]), people: Number(m[2]), names: [] };

  // "pay @kabir 20 for fuel", "send 200 usdc to @semi", "send $50 to Ada"
  m = t.match(/^(?:pay|send)\s+(?:(@?[a-z0-9_]+)\s+\$?([\d,.]+)|\$?([\d,.]+)\s*(?:usdc|usd|dollars|bucks)?\s+to\s+(@?[a-z0-9_]+|[1-9A-HJ-NP-Za-km-z]{32,44}))(?:\s+(?:for\s+)?(.*))?$/i);
  if (m) {
    const to = m[1] ?? m[4];
    const amt = m[2] ?? m[3];
    return { kind: "pay", amountCents: money(amt), to, note: (m[5] ?? "").trim() };
  }

  // "can you send $200", "send me $50"
  m = t.match(/(?:can you send|send me|could you send|pls send|please send)\s+(?:me\s+)?\$?([\d,.]+)/i);
  if (m) return { kind: "request", amountCents: money(m[1]) };

  const a = t.match(ADDR);
  if (a) return { kind: "address", address: a[0] };

  m = t.match(/\$([A-Za-z]{2,6})\b/);
  if (m) return { kind: "price", symbol: m[1].toUpperCase() };

  return { kind: "none" };
}

export function splitShares(totalCents: number, people: number) {
  const base = Math.floor(totalCents / people);
  return { each: base, ownerExtra: totalCents - base * people };
}
