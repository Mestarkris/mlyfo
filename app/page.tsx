import Link from "next/link";
import Logo from "@/components/Logo";
import HeroDemo from "@/components/HeroDemo";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MORE: [string, string, boolean][] = [
  ["Pay on reply", "“Can you send $50?” puts a ready-to-send payment above your keys.", true],
  ["Pay by @name", "Send to @kabir instead of a 44-character address.", true],
  ["Link scanner", "Kane opens a suspicious link in a real browser and tells you what it asks for.", true],
  ["Repeat payments", "“Rent on the 1st” sets up a monthly USDC payment.", true],
  ["Scam message check", "Flags “verify your wallet” style messages while you read them.", true],
  ["AI with a budget", "Let the assistant buy things for you, never more than you allow.", true],
  ["Rewrite with Claude", "Tidy, warm up or shorten a message before you send it.", true],
  ["Translate", "Reply in the other person’s language as you type.", false],
  ["Plans and places", "Find a time, add a Meet link and suggest somewhere to meet.", false],
  ["Swap and prices", "Swap through Jupiter and paste live prices for $SOL or $AAPL.", false],
  ["Group pots", "Collect money for trips and events, and let everyone see the total.", false],
  ["Cash out", "Turn USDC into local currency through supported partners.", false],
];

export default async function Home() {
  const user = await currentUser();
  const primary = user ? { href: "/app", label: "Open your dashboard" } : { href: "/signup", label: "Create free account" };
  return (
    <>
      <header className="nav"><div className="wrap">
        <Logo />
        <nav className="nav-links"><a href="#features">Features</a><a href="#security">Security</a><a href="#verified">Verified with Kane</a></nav>
        <div className="nav-cta">
          {user ? <Link className="btn btn-ink btn-sm" href="/app">Dashboard</Link> : (<>
            <Link className="btn btn-ghost btn-sm" href="/signin">Sign in</Link>
            <Link className="btn btn-ink btn-sm" href="/signup">Create account</Link>
          </>)}
        </div>
      </div></header>

      <main>
        <div className="hero"><div className="wrap">
          <h1>Text it. Pay it.<br />Stay in the chat.</h1>
          <p className="lede">The AI keyboard with a wallet built in.</p>
          <div className="hero-cta">
            <Link className="btn btn-ink" href={primary.href}>{primary.label}</Link>
            <Link className="btn btn-ghost" href={user ? "/app/pad" : "/signin?demo=1"}>{user ? "Open Mlyfo Pad" : "Try the demo account"}</Link>
          </div>
          <div className="platforms"><span><i className="dot" />Web and Android</span><span><i className="dot soon" />iPhone in 2027</span></div>
        </div></div>

        <section className="demo"><div className="wrap">
          <h2 className="center">Tap a message. Watch it pay.</h2>
          <p className="center-sub">Split bills, pay requests, check addresses and plan, from any app you type in.</p>
          <div className="demo-grid"><HeroDemo /></div>
        </div></section>

        <section id="features"><div className="wrap">
          <h2 className="center">Made for the money part of a conversation.</h2>
          <p className="center-sub">Other keyboards stop at the maths. Mlyfo collects the money, checks where it goes and keeps you inside your limits.</p>
          <div className="tiles">
            <div className="tile">
              <div className="tile-ui">
                <div className="receipt">
                  <div className="receipt-row"><span>🍝</span><span>Zoya</span><span className="amt">$59.00</span><span className="state ok">Paid</span></div>
                  <div className="receipt-row"><span>🚗</span><span>Kabir</span><span className="amt">$59.00</span><span className="state ok">Paid</span></div>
                  <div className="receipt-row"><span>🌊</span><span>Sofía</span><span className="amt">$59.00</span><span className="state">Link sent</span></div>
                </div>
              </div>
              <h3>Split a bill and collect every share.</h3>
              <p>Type “split 236 / 4”. Each person gets a payment link, and Mlyfo tracks who has paid.</p>
            </div>
            <div className="tile">
              <div className="tile-ui">
                <div className="mini warn"><span aria-hidden>!</span><span><b>This isn’t Ada’s saved address.</b> The first and last 4 characters match, but the middle doesn’t.</span></div>
              </div>
              <h3>Catch the wrong address before you pay.</h3>
              <p>Shield checks new recipients, look-alike addresses, known scams and risky links.</p>
            </div>
            <div className="tile">
              <div className="tile-ui">
                <div className="limit-ui">
                  <div className="meter"><i /></div>
                  <div className="meter-l"><span>$124 sent today</span><span>$200 limit</span></div>
                </div>
              </div>
              <h3>One tap under your limit.</h3>
              <p>Anything above the daily or per-person limit you set needs your confirmation.</p>
            </div>
          </div>
          <div className="more">
            {MORE.map(([t, d, n]) => <div key={t}><b>{t}{n && <span className="new">New</span>}</b><span>{d}</span></div>)}
          </div>
        </div></section>

        <div className="works"><div className="wrap">
          <p className="works-label">Works with</p>
          <ul className="works-list">{["Solana", "USDC", "Jupiter", "Seed Vault", "Phantom", "Google Calendar", "Google Meet", "Claude", "Kane CLI"].map((w) => <li key={w}>{w}</li>)}</ul>
        </div></div>

        <section id="security"><div className="wrap">
          <h2 className="center">Your keys never leave your wallet.</h2>
          <div className="sec-grid">
            <div><h3>Mlyfo can’t hold your funds</h3><p>Payments are signed in your own wallet or Seed Vault. We never see a private key.</p></div>
            <div><h3>Your typing stays yours</h3><p>Ordinary typing stays on the phone. Only messages about money, or ones you ask to rewrite, go to Claude to be read, and nothing moves until you tap.</p></div>
            <div><h3>You set the rules</h3><p>Limits, trusted contacts and Shield settings sync from your dashboard to every device you use.</p></div>
          </div>
        </div></section>

        <section id="verified" style={{ paddingTop: 0 }}><div className="wrap">
          <h2 className="center">Every money flow is tested in a real browser.</h2>
          <p className="center-sub">Before each release, Kane CLI signs up, splits a bill, tries to pay a scam address and breaks a spend limit, just like a person would. If anything fails, the release stops.</p>
        </div></section>

        <section style={{ paddingTop: 0 }}><div className="wrap">
          <div className="final">
            <h2>Pay from your keyboard.</h2>
            <p>Free to create an account. New accounts get $500 in demo USDC to try every feature.</p>
            <form action="/signup" method="get"><input type="email" name="email" placeholder="you@email.com" aria-label="Email address" /><button className="btn btn-ink">Create account</button></form>
          </div>
        </div></section>
      </main>

      <footer><div className="wrap"><span>© 2026 Mlyfo</span><a href="#">Privacy</a><a href="#">Terms</a><a href="#security">Security</a><a href="https://github.com">GitHub</a></div></footer>
    </>
  );
}
