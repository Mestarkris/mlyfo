# Mlyfo: interface design plan

Glyf is in the same category: a bright, Apple-like page with a phone demo. Mlyfo keeps that clean, premium feel and the "try it in the phone" demo. The palette, type, layout and every piece of copy are our own.

## Colour
| Token | Hex | Use |
|---|---|---|
| paper | #F3F5F8 | page background (a cool grey, not cream or white) |
| ink | #10151F | text and primary buttons |
| slate | #5A6375 | secondary text |
| tray | #D7DCE4 | keyboard tray |
| teal | #0B9C8A | Mlyfo accent: money that moved, success, links |
| amber | #D9480F | Shield warnings only |

Glyf uses violet and iMessage blue. We use teal for money and save amber for danger, so colour always tells you something.

## Type
- **Familjen Grotesk** (600) for headlines: a compact grotesk that feels engineered and a little warm.
- **Figtree** for body and UI text.
- Scale is 1.25 (16, 20, 25, 31, 39, 49, 61). Body line-height is 1.55; headlines use 1.02 with -0.02em tracking.

## Layout
```
nav  [mlyfo]  Features  Security  Pricing          Sign in  [Create account]
hero  H1 + subcopy + CTAs (left)  |  live phone demo (right)
       scenario list (6 real chat lines) drives the phone
features  big Split & Collect panel  |  Shield + Limits stacked
          plain list of everything else (no card grid)
works-with  one quiet line of partner names
security  3 short facts about keys
cta  email -> create account
```
Left-aligned throughout, with a 1200px max width.

## Principles
1. The phone demo is the one bold element. Everything else stays quiet.
2. Every keyboard card shows a real action with a real amount or name.
3. No waitlist anywhere. Every CTA leads to an account.
