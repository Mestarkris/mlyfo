"use client";
import { useEffect, useState } from "react";

/** Chrome's install prompt, kept until the person asks for it. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Install the Mlyfo app" when Chrome offers it; otherwise how to do it from the menu. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled(true);
    const offer = (e: Event) => { e.preventDefault(); setPrompt(e as InstallPrompt); };
    const done = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", offer); window.removeEventListener("appinstalled", done); };
  }, []);

  if (installed) return <p className="dl-note" data-testid="install-state">Mlyfo is installed on this device.</p>;
  if (prompt) {
    return (
      <button className="btn btn-light" data-testid="install-app" onClick={async () => {
        await prompt.prompt();
        if ((await prompt.userChoice).outcome === "accepted") setInstalled(true);
        setPrompt(null);
      }}>Install the Mlyfo app</button>
    );
  }
  return <p className="dl-note" data-testid="install-state">In Chrome, open the <b>⋮</b> menu and tap <b>Install app</b> or <b>Add to Home screen</b>.</p>;
}
