"use client";
import { useEffect, useRef, useState } from "react";
import Receipt from "./Receipt";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const TYPE = "split 236 / 4";

/**
 * The homepage hero. A 3D keyboard sits tilted over the scene; scrolling turns it flat,
 * types a split, lifts the Mlyfo card out of it and prints the receipt.
 * Progress is written to a CSS variable (--p) so every frame is a cheap transform/opacity change.
 */
export default function KeyboardStory({ children }: { children: React.ReactNode }) {
  const sec = useRef<HTMLElement>(null);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const el = sec.current;
    if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--p", "1");
      setTyped(TYPE.length);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      el.style.setProperty("--p", p.toFixed(4));
      const t = Math.min(1, Math.max(0, (p - 0.14) / 0.26));
      setTyped(Math.round(t * TYPE.length));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const text = TYPE.slice(0, typed);
  const last = typed > 0 && typed < TYPE.length ? TYPE[typed - 1] : null;
  const key = (c: string, extra = "") => (
    <span key={c} className={`k3 ${extra} ${last === c ? "on" : ""}`}>{c}</span>
  );

  return (
    <section ref={sec} className="story" aria-label="Mlyfo turns a typed split into payment links">
      <div className="story-stick">
        <div className="aurora" aria-hidden><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /></div>
        <div className="grain" aria-hidden />
        <div className="wrap story-grid">
          <div className="story-copy">{children}</div>

          <div className="story-scene" aria-hidden>
            <div className="scene-receipt">
              <Receipt title="Dinner" totalCents={23600} rows={[
                { name: "You", cents: 5900, state: "you" }, { name: "Zoya", cents: 5900, state: "paid" },
                { name: "Kabir", cents: 5900, state: "paid" }, { name: "Sofía", cents: 5900, state: "sent" },
              ]} />
            </div>

            <div className="glass scene-card">
              <div className="scene-card-top"><span className="pill cobalt">Split</span><span>Dinner, 4 people</span></div>
              <div className="scene-card-amt">$59.00 each</div>
              <div className="scene-card-sub">Payment links sent to Zoya, Kabir and Sofía</div>
            </div>

            <div className="glass scene-input">
              <span>{text || <span className="ph">Message Zoya</span>}</span><i className="caret" />
            </div>

            <div className="kb3d">
              <div className="kb3d-plate">
                {ROWS.map((r, i) => (
                  <div className="k3-row" key={r}>
                    {i === 2 && <span className="k3 fn">⇧</span>}
                    {[...r].map((c) => key(c))}
                    {i === 2 && <span className="k3 fn">⌫</span>}
                  </div>
                ))}
                <div className="k3-row">
                  <span className="k3 fn">123</span>
                  {key("/", "fn")}
                  <span className={`k3 space ${last === " " ? "on" : ""}`}>space</span>
                  <span className="k3 ret">⏎</span>
                </div>
                {/* number row hint for the digits being typed */}
                <div className="k3-digits">{["2", "3", "6", "4"].map((d) => <span key={d} className={`k3 mini ${last === d ? "on" : ""}`}>{d}</span>)}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="scroll-hint" aria-hidden><span />Scroll</div>
      </div>
    </section>
  );
}
