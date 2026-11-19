# Mlyfo: product spec (v0.1)

**One line:** the phone keyboard that can pay. You stay in whatever chat you're in, and Mlyfo writes, schedules, translates and moves money on Solana from the keys.

## Who it's for
- People on Solana phones (Seeker, Saga) and any Android phone with a Mobile Wallet Adapter wallet. iOS comes second.
- The core moment is someone in a chat asking for money ("send me $50", "bill was $236 for 4") or asking to plan something ("where should we meet?", "call at 6?").

## The problem
Paying someone in crypto from a chat today takes about 6 app switches: copy the address, open the wallet, paste, check, sign, go back and paste the transaction link. Each switch is a chance to paste the wrong address.

## What's included (parity with the category)
| Capability | In the keyboard |
|---|---|
| AI rewrite / tone | Highlight the text, then tap "Tidy" |
| Translate | Typed text is translated into the other person's language |
| Calendar + meeting link | "call at 6?" becomes a booked slot and a Meet link |
| Places | "where should we meet?" brings up 3 nearby spots |
| Wallet send / swap | Send SOL or USDC, or swap through Jupiter, from the key row |
| Prices | Type `$SOL` or `$AAPL` to drop in a live price card |

## What makes it different (our three advanced features)
1. **Split & Collect.** Type `split 236 / 4` and Mlyfo posts a Solana Pay request for $59 to each person. It then tracks who has paid in a small receipt card and nudges anyone who hasn't. Glyf only works out the maths; we collect the money.
2. **Address Shield.** Every address or link that is pasted or typed is checked before you can send to it: whether it's a first-time recipient, whether it looks like a poisoned address that matches the first and last 4 characters of a contact, whether it's on a known scam list, and whether a link points to a drainer domain. Risky sends need a second confirmation.
3. **Spend Limits.** Set a daily cap and a cap per contact. Anything under the cap is sent with one tap. Anything over it needs a fingerprint or your Seed Vault. The limits are set on the web dashboard and synced to the keyboard.

## Accounts (no waitlist)
- Register with name, email and password. You go straight into the dashboard.
- Dashboard: pick a username, link a wallet address, set spend limits, turn Shield on or off, and download the keyboard build.

## Metrics
- Activation: percentage of new accounts that set a limit **and** link a wallet within 24 hours.
- Core: payments sent from the keyboard per weekly active user.
- Safety: sends blocked by Shield and confirmed as bad.

## Milestones
1. **Web (this repo):** landing page, registration, dashboard with saved settings. ✅
2. Android IME: Kotlin `InputMethodService`, Mobile Wallet Adapter, settings pulled from `/api/settings`.
3. Seed Vault signing on Seeker, and dApp Store listing.
4. iOS keyboard extension, with full access and an App Group to the wallet.
