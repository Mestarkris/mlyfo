import Link from "next/link";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import InstallApp from "@/components/InstallApp";

export const metadata = { title: "Mlyfo for Android", description: "Install the Mlyfo app from Chrome, and the Mlyfo keyboard preview for typing in any app." };

const REPO = "https://github.com/Mestarkris/mlyfo";
const APK = `${REPO}/releases/download/keyboard-preview/mlyfo-keyboard.apk`;

/** The current keyboard build: GitHub rebuilds it on every change, so its size and fingerprint come from the release. */
async function build(): Promise<{ size: number; sha256: string | null; at: string } | null> {
  try {
    const r = await fetch("https://api.github.com/repos/Mestarkris/mlyfo/releases/tags/keyboard-preview", {
      headers: { accept: "application/vnd.github+json" }, next: { revalidate: 600 },
    });
    if (!r.ok) return null;
    const rel = await r.json();
    const a = rel.assets?.find((x: { name: string }) => x.name === "mlyfo-keyboard.apk");
    if (!a) return null;
    return { size: a.size, sha256: typeof a.digest === "string" ? a.digest.replace(/^sha256:/, "") : null, at: a.updated_at };
  } catch {
    return null;
  }
}

export default async function Android() {
  const b = await build();
  return (
    <div className="landing">
      <header className="nav"><div className="wrap">
        <Logo />
        <nav className="nav-links"><Link href="/#features">Features</Link><Link href="/#security">Security</Link><Link href="/#verified">Verified with Kane</Link></nav>
        <div className="nav-cta"><Link className="btn btn-light btn-sm" href="/signin?demo=1">Try the demo</Link></div>
      </div></header>

      <main>
        <section className="dl-hero"><div className="wrap">
          <h1>Mlyfo on your Android phone</h1>
          <p className="lede">Two ways to get it. Install the app from Chrome in one tap, and add the keyboard to split bills and check addresses from any chat.</p>
        </div></section>

        <section style={{ paddingTop: 0 }}><div className="wrap dl-grid">
          <div className="glass dl-card" data-testid="install-card">
            <span className="dl-step">1</span>
            <h2>The Mlyfo app</h2>
            <p>Your wallet, Shield, splits and receipts, with its own icon and full screen. It installs from Chrome, with no download and no warnings.</p>
            <InstallApp />
          </div>

          <div className="glass dl-card" data-testid="keyboard-card">
            <span className="dl-step">2</span>
            <h2>The Mlyfo keyboard <small>Preview</small></h2>
            <p>Type in WhatsApp, Telegram or any app. When a message is about money, a Mlyfo card appears above the keys and does the job right there: Shield checks the address, the payment goes out with a few seconds to undo, and split links drop into the chat.</p>
            <a className="btn btn-light" href={APK} data-testid="download-apk">Download the keyboard</a>
            <p className="dl-note">Android 9 or newer{b ? ` · ${(b.size / 1024 / 1024).toFixed(1)} MB` : ""} · version 0.2.0 preview</p>
            <ol className="dl-steps">
              <li>Tap <b>Download the keyboard</b>. Chrome warns about files from outside the Play Store: tap <b>Download anyway</b>.</li>
              <li>Open the file. When Android asks, allow Chrome to install apps, then tap <b>Install</b>.</li>
              <li>Open <b>Mlyfo Keyboard</b>, tap <b>Turn on the Mlyfo keyboard</b>, then <b>Switch to Mlyfo</b>.</li>
              <li>To pay and split, sign in once in the same app, or tap <b>Use the demo account</b>.</li>
            </ol>
          </div>
        </div></section>

        <section id="safe" style={{ paddingTop: 0 }}><div className="wrap">
          <h2 className="center">Why the keyboard is safe to install</h2>
          <p className="center-sub">A keyboard sees what you type, so it should ask for as little as possible. This one asks for one thing: to reach Mlyfo when you tap a card.</p>
          <div className="sec-grid">
            <div className="glass"><Icon name="shield" /><h3>Internet is its only permission</h3><p>It can’t read your contacts, photos, files or location. It reads only the line you’re typing and what you copy, and never password fields.</p></div>
            <div className="glass"><Icon name="check" /><h3>Keystrokes never leave your phone</h3><p>It talks only to mlyfo.vercel.app, and only when you tap a Mlyfo card: the address to check, or the payment or split you asked for. Nothing else is sent.</p></div>
            <div className="glass"><Icon name="receipt" /><h3>Built in public</h3><p>Built from <a href={`${REPO}/tree/main/android`}>open-source code</a> by GitHub, with a <a href={`${REPO}/actions/workflows/android.yml`}>public build log</a>. Nobody’s laptop is involved.</p></div>
          </div>
          <div className="glass dl-print" data-testid="fingerprint">
            <h3>Check your download</h3>
            {b?.sha256
              ? <><p>The SHA-256 fingerprint of the current build. It should match the file on your phone.</p><code>{b.sha256}</code></>
              : <p>The fingerprint of the current build is listed on the <a href={`${REPO}/releases/tag/keyboard-preview`}>release page</a>.</p>}
          </div>
          <p className="center-sub" style={{ marginTop: 28 }}>Payments are finished in Mlyfo, where Shield checks them first. Wallet signing on the phone with Seed Vault on Solana Seeker, and the iPhone keyboard, are next.</p>
        </div></section>
      </main>

      <footer><div className="wrap"><span>© 2026 Mlyfo</span><Link href="/">Home</Link><Link href="/#verified">Verified with Kane</Link><a href={REPO}>GitHub</a></div></footer>
    </div>
  );
}
