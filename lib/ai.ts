import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parseIntent, type Intent } from "./intent";

/**
 * The language model behind the keyboard. It reads a chat message the way a person would
 * ("can u cover my half of the cab, it was 18") and turns it into one Mlyfo action.
 * Without ANTHROPIC_API_KEY, or if the call fails, the rule-based parser answers instead.
 */
export const MODEL = "claude-haiku-5-5";

let client: Anthropic | null = null;
export function aiEnabled() {
  return !!process.env.ANTHROPIC_API_KEY;
}
function claude() {
  return (client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 }));
}

const IntentSchema = z.object({
  kind: z.enum(["split", "pay", "request", "address", "link", "price", "none"]),
  amount_usd: z.number().describe("Dollar amount, 0 if none. For split, the bill total."),
  people: z.number().int().describe("For split: everyone sharing the bill including the writer. 0 otherwise."),
  to: z.string().describe("For pay: the recipient as @handle or a Solana address. Empty otherwise."),
  names: z.array(z.string()).describe("For split: @handles mentioned, without the @. Empty otherwise."),
  note: z.string().describe("What the money is for, a few words, or empty."),
  value: z.string().describe("For address: the Solana address. For link: the URL. For price: the ticker. Empty otherwise."),
});

const SYSTEM = `You are the intent reader inside Mlyfo, a phone keyboard that can move money in USDC.
You get one chat message and decide which single keyboard action fits it.

Actions:
- split: the writer wants to divide a bill. "dinner was 236 for 4 of us", "split 90 with @ada and @kabir".
- pay: the writer wants to send money to someone named in the message. "send kabir 20 for the cab", "pay @semi 200".
- request: the other person in the chat is asking the writer for money. "can you send me 50?", "you owe me 12 for lunch". Only use request for messages written by the other person.
- address: the message contains a Solana address and no payment instruction.
- link: the message contains a URL.
- price: the writer asks about a token or stock price, like "$SOL" or "how much is bonk".
- none: anything else, including small talk and anything you are not sure about.

Rules: amounts are US dollars. Handles are lowercase without spaces. When a name is given without @, use it as the handle in lowercase.
Never invent an amount or recipient that is not in the message. Prefer none over guessing.`;

export type AiIntent = { intent: Intent; source: "model" | "rules" };

export async function readIntent(text: string, from: "me" | "them", contacts: string[]): Promise<AiIntent> {
  const rules = parseIntent(text);
  if (!aiEnabled() || !text.trim()) return { intent: rules, source: "rules" };
  try {
    const res = await claude().messages.parse({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low", format: zodOutputFormat(IntentSchema) },
      system: SYSTEM,
      messages: [{
        role: "user",
        content: `Written by: ${from === "me" ? "the keyboard's owner" : "the other person in the chat"}\nSaved contacts: ${contacts.map((c) => "@" + c).join(", ") || "none"}\nMessage: ${text}`,
      }],
    });
    const o = res.stop_reason === "refusal" ? null : res.parsed_output;
    if (!o) return { intent: rules, source: "rules" };
    return { intent: toIntent(o, rules), source: "model" };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`Mlyfo AI: ${e.status} ${e.message}`);
    else console.error("Mlyfo AI:", e);
    return { intent: rules, source: "rules" };
  }
}

function toIntent(o: z.infer<typeof IntentSchema>, rules: Intent): Intent {
  const cents = Math.round(o.amount_usd * 100);
  switch (o.kind) {
    case "split":
      if (cents <= 0) return rules;
      return { kind: "split", totalCents: cents, people: Math.max(2, o.people || o.names.length + 1), names: o.names.map((n) => n.replace(/^@/, "").toLowerCase()) };
    case "pay":
      if (cents <= 0 || !o.to) return rules;
      return { kind: "pay", amountCents: cents, to: o.to.replace(/^@/, ""), note: o.note };
    case "request":
      return cents > 0 ? { kind: "request", amountCents: cents } : rules;
    case "address":
      return o.value ? { kind: "address", address: o.value } : rules;
    case "link":
      return o.value ? { kind: "link", url: o.value } : rules;
    case "price":
      return o.value ? { kind: "price", symbol: o.value.replace(/^\$/, "").toUpperCase() } : rules;
    default:
      return rules;
  }
}

const TONES = { tidy: "Fix spelling and grammar. Keep the writer's voice and length.", warm: "Make it warmer and friendlier.", brief: "Make it as short as possible while keeping the meaning." } as const;
export type Tone = keyof typeof TONES;

/** "Tidy" key: rewrites a draft before it is sent. Returns null when the model is off. */
export async function rewrite(text: string, tone: Tone): Promise<string | null> {
  if (!aiEnabled() || !text.trim()) return null;
  try {
    const res = await claude().messages.create({
      model: MODEL,
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: `You rewrite chat messages typed on a phone keyboard. ${TONES[tone]} Keep amounts, names, @handles, addresses and links exactly as written. Reply with the rewritten message only.`,
      messages: [{ role: "user", content: text }],
    });
    if (res.stop_reason === "refusal") return null;
    const out = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    return out || null;
  } catch (e) {
    console.error("Mlyfo AI rewrite:", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return null;
  }
}
