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
- **Kabir** sends an airdrop link: *Deep scan with Kane* opens it in a real browser.

## How Kane is used

**1. Kane verifies every release (`kane/tests/*_test.md`)**

Five plain-English tests cover the flows that move money:

| Test | What Kane proves |
|---|---|
| `01_signup` | A new user can sign up and lands on a funded dashboard |
| `02_split` | $236 split four ways gives $59.00 each and a link per person |
| `03_shield_lookalike` | A look-alike of a saved contact's address is blocked |
| `04_spend_limit` | A payment over the limit waits for password confirmation, then sends |
| `05_scam_link` | A fake Phantom airdrop link is rated dangerous |

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

## Stack

- Next.js 15 (app router) with React 19 and TypeScript.
- libSQL for storage: a local SQLite file in development, Turso in production (`lib/db.ts`).
- Passwords hashed with scrypt, and httpOnly session cookies.

## Map
```
app/             pages + API routes (auth, pay, splits, shield, settings)
lib/money.ts     the single money path: Shield, then limits, then settle
lib/shield.ts    address and link checks
lib/kane.ts      Kane CLI runner used by the Link Scanner
kane/tests/      plain-English Kane tests
scripts/         verify.mjs (Kane) and loop.mjs (Kane, then agent, then Kane)
```
