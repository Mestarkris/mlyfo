# Mlyfo

**The AI keyboard that can pay, and won't ship until Kane CLI says it works.**

Mlyfo puts a wallet inside your keyboard. It splits a bill four ways and collects each share. It blocks look-alike scam addresses. It holds back payments that go over your spend limits until you confirm them. Every one of those money flows is tested by [Kane CLI](https://www.testmuai.com/kane-cli/) in a real browser before a release. When a test fails, the failure goes back to the coding agent (Claude Code), which fixes the code and runs Kane again.

Built for the KaneCLI Online Hackathon (Web + Mobile category).

## Try it (judges)

**Live:** https://mlyfo.vercel.app (click **Try the demo account**). Kane's live-site run is under **Verified by Kane** once you sign in.

Or run it locally:

```bash
git clone <this repo> && cd mlyfo
npm install
npm run dev            # http://localhost:3100
```

| | |
|---|---|
| Demo login | `demo@mlyfo.app` / `mlyfo-demo-2026` (or click **Try the demo account** on the home page) |
| Node | 22.13 or newer. Locally the app keeps its data in a SQLite file in `data/`, so no database setup is needed |
| Deploy | Vercel + Turso. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; the schema and demo data are created on first start |
| Money | Demo USDC only. New accounts start with $500. Nothing touches mainnet |
| Reset data | `npm run reset`, then restart `npm run dev` |

Things to try in **Mlyfo Pad** (`/app/pad`):
- **Zoya**: tap *Create split links*. You get $59 each, plus a payment link per person.
- **Semi** asks for $200: *Pay on reply* goes over your limit and asks for your password.
- **Ada** sends a "new wallet": Shield spots the look-alike and highlights the characters that differ.
- **Kabir** sends an airdrop link: Shield rates it dangerous. *Deep scan with Kane* opens it in a real browser when the server has Kane installed (on Vercel it falls back to the quick check).
- **Pay anyone**, e.g. `pay @kabir 10 for lunch`: you get 5 seconds to undo, then a receipt with an ID, a public receipt page and a real Solana devnet record.
- **People** (`/app/people`): save someone by @username or wallet, or send an *Ask for their address* link. Saving a look-alike of someone you already have is refused.

## How Kane is used

**1. Kane verifies every release (`kane/tests/*_test.md`)**

Eight plain-English tests cover the flows that move money. The latest run passed 8/8 against the live site:

| Test | What Kane proves |
|---|---|
| `01_signup` | A new user can sign up and lands on a funded dashboard |
| `02_split` | $236 split four ways gives $59.00 each and a link per person |
| `03_shield_lookalike` | A look-alike of a saved contact's address is blocked |
| `04_spend_limit` | A payment over the limit waits for password confirmation, then sends |
| `05_scam_link` | A fake Phantom airdrop link is rated dangerous |
| `06_contact_lookalike` | Saving a look-alike of a saved person is refused |
| `07_name_squat` | A name that is both a saved contact and another user asks who you meant |
| `08_receipt` | A payment gives a receipt ID and a public receipt page |

```bash
npm install -g @testmuai/kane-cli && kane-cli login
npm run verify         # runs all tests, writes kane/results/latest.json
```

Results show up in the app under **Verified by Kane** (`/app/verified`).

**2. The closed loop: Kane, then the agent, then Kane again (`npm run loop`)**

`scripts/loop.mjs` works like this:
1. Runs Kane.
2. On failure, builds a fix request from the test, Kane's summary, the failed step and the last NDJSON events (`kane/results/fix-request.md`).
3. Pipes it to the coding agent. The default is `claude -p --permission-mode acceptEdits`; change it with `MLYFO_AGENT_CMD`.
4. Runs Kane again, up to 3 attempts.

`npm run ship` only builds once the loop passes.

**3. Kane inside the product: Link Scanner**

When someone pastes a link, **Deep scan with Kane** runs `kane-cli run … --agent` on the server. Kane opens the page in a real browser without typing anything in. It then reports whether the page asks for a seed phrase, asks you to connect a wallet, or promises free tokens. Kane's `final_state` decides the verdict (`lib/kane.ts`).

## How Mlyfo works on a phone

![One payment on a phone, from keyboard to receipt](docs/phone-flow.svg)

The live site is the keyboard's engine running in a browser: every action is real and verified by Kane. The Android keyboard is the next milestone, and this is how it works there.

**What a keyboard can see.** A phone keyboard reads the text field you're typing in. It can't read the chat above it, so Mlyfo acts on three things:
1. **What you type.** `split 236 / 4` or `pay mum 20` puts a card above the keys. Works on Android and iOS.
2. **What you copy.** Copy Zoya's "bill was $236 for 4 of us" and the keyboard offers the split. Copying is a deliberate act, so nothing is read behind your back.
3. **What you share.** Share a link or address to Mlyfo and Shield checks it.

**Where each part runs**

| Part | Runs on | Why |
|---|---|---|
| Reading `pay mum 20` | The phone (`lib/intent.ts`) | Instant, offline, nothing leaves the phone |
| Messier phrasing | Server → Claude, only after you tap | Ordinary typing never leaves the phone |
| Shield and your people | The phone, with the scam list refreshed from the server | A safety check must work on a bad connection |
| Spend limits | Server and wallet | A keyboard can be swapped out; a limit can't live only there |
| Signing | **Your wallet** via Solana Mobile Wallet Adapter (Phantom, Solflare, Seed Vault) | Mlyfo never holds keys |
| Receipt | The keyboard types `Sent you $20.00 ✓ mlyfo.app/r/MLY-…` into the chat | Works in every chat app, because it's just text |

**Rules a keyboard has to keep**
- Keystrokes are never logged. Only the line you act on is sent, and only after a tap.
- In password and card fields Mlyfo becomes a plain keyboard.
- No wallet keys in the keyboard. Every payment is approved on the wallet's own screen; over your limit, with your fingerprint.
- The card shows who and how much in large type before any money moves.
- On iOS, payments need "Allow Full Access" (keyboards have no network without it). Without it, Mlyfo still works as a keyboard, and links and addresses can be shared to it.

**Next milestones:** Android keyboard (Kotlin `InputMethodService` + Mobile Wallet Adapter), Seed Vault signing on Solana Seeker, then the iOS keyboard extension.

## Stack

- Next.js 15 (app router) with React 19 and TypeScript.
- libSQL for storage: a local SQLite file in development, Turso in production (`lib/db.ts`).
- Passwords hashed with scrypt, and httpOnly session cookies.
- Claude (`claude-haiku-5-5`, `lib/ai.ts`) reads messages the patterns miss and rewrites drafts. It switches on with `ANTHROPIC_API_KEY`; without it, the patterns do the reading.
- Receipts are written as memos to Solana devnet after each payment (`lib/chain.ts`, `SOLANA_DEVNET_SECRET`). Demo USDC moves inside Mlyfo; the memo is the public proof.

## Map
```
app/             pages + API routes (auth, pay, splits, shield, settings)
lib/money.ts     the single money path: who you mean, Shield, limits, settle, receipt
lib/intent.ts    reads "split 236 / 4", "pay mum 20" (runs on the phone in the keyboard)
lib/ai.ts        Claude for messages the patterns miss, and rewrites
lib/chain.ts     Solana devnet record for each receipt
lib/shield.ts    address and link checks
lib/kane.ts      Kane CLI runner used by the Link Scanner
kane/tests/      plain-English Kane tests
scripts/         verify.mjs (Kane) and loop.mjs (Kane, then agent, then Kane)
```
