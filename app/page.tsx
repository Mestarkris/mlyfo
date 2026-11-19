import Link from "next/link";
import Logo from "@/components/Logo";
import HeroDemo from "@/components/HeroDemo";
import Icon from "@/components/Icon";
import Reveal from "@/components/Reveal";
import KeyboardStory from "@/components/KeyboardStory";
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
    <div className="landing">
      <header className="nav"><div className="wrap">
        <Logo />
        <nav className="nav-links"><a href="#features">Features</a><a href="#security">Security</a><a href="#verified">Verified with Kane</a></nav>
        <div className="nav-cta">
          {user ? <Link className="btn btn-light btn-sm" href="/app">Dashboard</Link> : (<>
            <Link className="nav-link" href="/signin">Sign in</Link>
            <Link className="btn btn-light btn-sm" href="/signup">Create account</Link>
          </>)}
        </div>
      </div></header>

      <main>
        <KeyboardStory>
          <h1>Split the bill and pay friends from your keyboard</h1>
          <p className="lede">Mlyfo is a phone keyboard with a wallet in it. It splits bills, pays requests and checks every address before money moves, without leaving the chat.</p>
          <div className="hero-cta">
            <Link className="btn btn-light" href={primary.href}>{primary.label}</Link>
            <Link className="btn btn-glass" href={user ? "/app/pad" : "/signin?demo=1"}>{user ? "Open Mlyfo Pad" : "Try the demo account"}</Link>
          </div>
        </KeyboardStory>

        <section className="demo"><div className="wrap">
          <Reveal><h2 className="center">Tap a message to see Mlyfo answer</h2>
          <p className="center-sub">Each chat holds something people really send: a bill, a request, a new address, a dodgy link.</p></Reveal>
          <Reveal className="demo-grid"><HeroDemo /></Reveal>
        </div></section>

        <section id="features"><div className="wrap">
          <Reveal><h2 className="center">Made for the money part of a conversation</h2>
          <p className="center-sub">Other keyboards stop at the maths. Mlyfo collects the money, checks where it goes and keeps you inside your limits.</p></Reveal>
          <div className="tiles">
            <Reveal className="tile glass hue-cobalt">
              <div className="tile-ui">
                <div className="tile-split">
                  {[["Zoya", "Paid"], ["Kabir", "Paid"], ["Sofía", "Link sent"]].map(([n, st]) => (
                    <div key={n} className="tile-row"><span>{n}</span><span className="num">$59.00</span><span className={st === "Paid" ? "ok" : "muted"}>{st}</span></div>
                  ))}
                </div>
              </div>
              <h3>Split a bill and collect every share</h3>
              <p>Type “split 236 / 4”. Each person gets a payment link, and Mlyfo tracks who has paid.</p>
            </Reveal>
            <Reveal className="tile glass hue-rose">
              <div className="tile-ui">
                <div className="tile-warn"><Icon name="alert" /><span><b>This isn’t Ada’s saved address.</b> The first and last 4 characters match, but the middle doesn’t.</span></div>
              </div>
              <h3>Catch the wrong address before you pay</h3>
              <p>Shield checks new recipients, look-alike addresses, known scams and risky links.</p>
            </Reveal>
            <Reveal className="tile glass hue-amber">
              <div className="tile-ui">
                <div className="tile-limit">
                  <div className="tile-limit-top"><span>Sent today</span><span className="num">$124.00 of $200.00</span></div>
                  <div className="meter"><i /></div>
                </div>
              </div>
              <h3>One tap under your limit</h3>
              <p>Anything above the daily or per-person limit you set needs your confirmation.</p>
            </Reveal>
          </div>
          <Reveal className="more">
            {MORE.map(([t, d]) => <div key={t}><b>{t}</b><span>{d}</span></div>)}
          </Reveal>
        </div></section>

        <div className="works"><div className="wrap">
          <p className="works-label">Works with</p>
          <ul className="works-list">{["Solana", "USDC", "Jupiter", "Seed Vault", "Phantom", "Google Calendar", "Google Meet", "Claude", "Kane CLI"].map((w) => <li key={w}>{w}</li>)}</ul>
        </div></div>

        <section id="security"><div className="wrap">
          <Reveal><h2 className="center">Your keys never leave your wallet</h2></Reveal>
          <Reveal className="sec-grid">
            <div className="glass"><Icon name="shield" /><h3>Mlyfo can’t hold your funds</h3><p>Payments are signed in your own wallet or Seed Vault. We never see a private key.</p></div>
            <div className="glass"><Icon name="check" /><h3>Your typing stays yours</h3><p>Ordinary typing stays on the phone. Only messages about money, or ones you ask to rewrite, go to Claude to be read, and nothing moves until you tap.</p></div>
            <div className="glass"><Icon name="receipt" /><h3>You set the rules</h3><p>Limits, trusted contacts and Shield settings sync from your dashboard to every device you use.</p></div>
          </Reveal>
        </div></section>

        <section id="verified" style={{ paddingTop: 0 }}><div className="wrap">
          <Reveal><h2 className="center">Every money flow is tested in a real browser</h2>
          <p className="center-sub">Before each release, Kane CLI signs up, splits a bill, tries to pay a scam address and breaks a spend limit, just like a person would. If anything fails, the release stops.</p></Reveal>
        </div></section>

        <section style={{ paddingTop: 0 }}><div className="wrap">
          <Reveal className="final glass">
            <h2>Pay from your keyboard</h2>
            <p>Free to create an account. New accounts get $500 in demo USDC to try every feature. Web and Android now, iPhone in 2027.</p>
            <form action="/signup" method="get"><input type="email" name="email" placeholder="you@email.com" aria-label="Email address" /><button className="btn btn-light">Create account</button></form>
          </Reveal>
        </div></section>
      </main>

      <footer><div className="wrap"><span>© 2026 Mlyfo</span><a href="#">Privacy</a><a href="#">Terms</a><a href="#security">Security</a><a href="https://github.com/Mestarkris/mlyfo">GitHub</a></div></footer>
    </div>
  );
}
