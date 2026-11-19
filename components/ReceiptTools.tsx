"use client";
import { useEffect, useState } from "react";
import Icon from "./Icon";

type Chain = { chain: string; explorer: string | null; sig: string | null };

/** Shows where the Solana record is, and polls until it lands (about 30 seconds at most). */
export function ChainStatus({ id, initial, compact = false }: { id: string; initial?: Chain; compact?: boolean }) {
  const [c, setC] = useState<Chain>(initial ?? { chain: "pending", explorer: null, sig: null });
  useEffect(() => {
    if (c.chain !== "pending") return;
    let n = 0;
    const t = setInterval(async () => {
      n++;
      try { const r = await fetch(`/api/receipts/${id}`); if (r.ok) { const d = await r.json(); setC(d); if (d.chain !== "pending") clearInterval(t); } } catch {}
      if (n > 15) clearInterval(t);
    }, 2000);
    return () => clearInterval(t);
  }, [id, c.chain]);
  const cls = `chain ${compact ? "compact" : ""} ${c.chain}`;
  if (c.chain === "recorded" && c.explorer)
    return <a className={cls} href={c.explorer} target="_blank" rel="noreferrer" data-testid="chain-link"><Icon name="link" /><span>Recorded on Solana <b className="num">{c.sig!.slice(0, 6)}…{c.sig!.slice(-6)}</b></span></a>;
  if (c.chain === "pending") return <div className={cls} role="status"><span className="spin" aria-hidden />Recording on Solana…</div>;
  return <div className={cls}>Not recorded on Solana yet. The payment itself is complete</div>;
}

/** Counts a figure up once when it first appears. Static for reduced motion. */
export function CountUp({ cents }: { cents: number }) {
  const [v, setV] = useState(cents);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now(), dur = 600;
    let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - start) / dur); setV(Math.round(cents * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    setV(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [cents]);
  return <>{"$" + (v / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}
