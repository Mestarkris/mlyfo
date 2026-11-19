"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Scenario = {
  em: string; who: string; tag: string; tool: string;
  thread: string[]; type: string; card: React.ReactNode;
};

function SplitCard() {
  const [paid, setPaid] = useState(1);
  useEffect(() => {
    const ts = [setTimeout(() => setPaid(2), 1500), setTimeout(() => setPaid(3), 2300)];
    return () => ts.forEach(clearTimeout);
  }, []);
  const ppl = ["You", "Zoya", "Kabir", "Sofía"];
  return (
    <>
      <div className="smart-top"><span className="chip">Split</span>Dinner, 4 people</div>
      <div className="smart-title">$59.00 each</div>
      <div className="people">
        {ppl.map((p, i) => (
          <div key={p} className={`person ${i <= paid ? "paid flip" : ""}`}><b>{p}</b>{i === 0 ? "covered" : i <= paid ? "paid" : "sent"}</div>
        ))}
      </div>
      <div className="smart-actions"><span className="btn btn-ink">Send requests</span><span className="btn btn-ghost">Edit split</span></div>
    </>
  );
}

const ADA = "AdaK7pQ2vRm9xLwT4nBc8ZsY3hJfUe6GdN1oPq5Ma2Fx";
const FAKE = "AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx";

const SCENARIOS: Scenario[] = [
  { em: "🍝", who: "Zoya", tag: "Split", tool: "split", thread: ["that was so good 😮‍💨", "bill was $236 for 4 of us"], type: "split 236 / 4", card: <SplitCard /> },
  {
    em: "🏆", who: "Semi", tag: "Pay", tool: "pay", thread: ["can you send $200 for server costs?", "usdc on sol 🙏"], type: "",
    card: (<>
      <div className="smart-top"><span className="chip">Pay</span><span className="chip grey">Shield checked</span></div>
      <div className="smart-title">Send 200 USDC to @semi</div>
      <div className="smart-sub">Over your $100 per-payment limit, so you’ll confirm it.</div>
      <div className="smart-actions"><span className="btn btn-teal">Pay 200 USDC</span><span className="btn btn-ghost">Change</span></div>
    </>),
  },
  {
    em: "🧑🏾", who: "Ada?", tag: "Shield", tool: "pay", thread: ["new wallet, send here pls", FAKE.slice(0, 8) + "…" + FAKE.slice(-6)], type: "",
    card: (<>
      <div className="smart-top"><span className="chip warn">Shield</span>Look-alike address</div>
      <div className="smart-title">This isn’t Ada’s saved address</div>
      <div className="addr" style={{ marginTop: 6 }}>
        {[...FAKE].map((c, i) => <span key={i} className={c !== ADA[i] ? "x" : ""}>{c}</span>)}
      </div>
      <div className="smart-actions"><span className="btn btn-ink">Use saved address</span><span className="btn btn-ghost">Report</span></div>
    </>),
  },
  {
    em: "📈", who: "Daniel", tag: "Plan", tool: "cal", thread: ["let’s talk numbers this week", "call at 6 tomorrow?"], type: "works for me",
    card: (<>
      <div className="smart-top"><span className="chip">Plan</span>You’re free at 6:00 PM</div>
      <div className="smart-title">Thu, 6:00 to 6:30 PM</div>
      <div className="smart-sub">Adds it to your calendar and pastes a Meet link.</div>
      <div className="smart-actions"><span className="btn btn-ink">Book and send link</span><span className="btn btn-ghost">Other times</span></div>
    </>),
  },
  {
    em: "🌊", who: "Sofía", tag: "Translate", tool: "tr", thread: ["¿Nos vemos mañana en el café?"], type: "yes! see you at 10",
    card: (<>
      <div className="smart-top"><span className="chip">Translate</span>English to Spanish</div>
      <div className="smart-title">¡Sí! Nos vemos a las 10.</div>
      <div className="smart-sub">Sofía writes in Spanish, so Mlyfo offers your reply in Spanish.</div>
      <div className="smart-actions"><span className="btn btn-ink">Use Spanish</span><span className="btn btn-ghost">Keep English</span></div>
    </>),
  },
  {
    em: "🔗", who: "Unknown", tag: "Link scan", tool: "ai", thread: ["claim your free SOL airdrop 🎁", "https://phantorn-airdrop.app/claim"], type: "",
    card: (<>
      <div className="smart-top"><span className="chip warn">Shield</span>Opened in a safe test browser</div>
      <div className="smart-title">Don’t open this link</div>
      <div className="smart-sub">It asks for your seed phrase, and the address imitates phantom.app.</div>
      <div className="smart-actions"><span className="btn btn-ink">Don’t open</span><span className="btn btn-ghost">See what it asks for</span></div>
    </>),
  },
];

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export default function HeroDemo() {
  const [i, setI] = useState(0);
  const [shown, setShown] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const [cardKey, setCardKey] = useState(0);
  const [showCard, setShowCard] = useState(false);
  const [down, setDown] = useState<string | null>(null);
  const auto = useRef(true);
  const phone = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);

  useEffect(() => { reduce.current = matchMedia("(prefers-reduced-motion: reduce)").matches; }, []);

  const press = useCallback((c: string) => { setDown(c); setTimeout(() => setDown(null), 110); }, []);

  // Orchestrate one scenario: typing dots, bubbles, card, then the user's reply types out.
  useEffect(() => {
    const s = SCENARIOS[i];
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, reduce.current ? 0 : ms));
    setShown([]); setTyped(""); setShowCard(false); setTyping(true);
    s.thread.forEach((m, k) => at(500 + k * 650, () => { setShown((x) => [...x, m]); if (k === s.thread.length - 1) setTyping(false); }));
    const cardAt = 500 + s.thread.length * 650;
    at(cardAt, () => { setShowCard(true); setCardKey((k) => k + 1); });
    [...s.type].forEach((ch, k) => at(cardAt + 300 + k * 70, () => { setTyped(s.type.slice(0, k + 1)); press(ch.toLowerCase()); }));
    if (auto.current && !reduce.current) at(6200, () => setI((x) => (x + 1) % SCENARIOS.length));
    return () => timers.forEach(clearTimeout);
  }, [i, press]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.tagName !== "INPUT") press(e.key.toLowerCase()); };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [press]);

  const tilt = (e: React.MouseEvent) => {
    if (reduce.current || !phone.current) return;
    const r = phone.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    phone.current.style.transform = `perspective(1400px) rotateY(${x * 8}deg) rotateX(${-y * 6}deg)`;
  };
  const untilt = () => { if (phone.current) phone.current.style.transform = ""; };

  const s = SCENARIOS[i];
  return (
    <div className="hero-grid-demo">
      <div className="try">
        <h3>Tap a message to see Mlyfo answer it</h3>
        <div className="scen">
          {SCENARIOS.map((x, k) => (
            <button key={k} aria-pressed={k === i} onClick={() => { auto.current = false; setI(k); }}>
              <span className="em">{x.em}</span><span>{x.thread[x.thread.length - 1].slice(0, 46)}</span><span className="tag">{x.tag}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="stage" onMouseMove={tilt} onMouseLeave={untilt}>
        <div className="phone" ref={phone}>
          <div className="screen">
            <div className="island" />
            <div className="status"><span>9:41</span><span>5G 87%</span></div>
            <div className="chat-head"><div className="ava">{s.em}</div><div><b>{s.who}</b><small>Messages</small></div></div>
            <div className="msgs">
              {shown.map((m, k) => <div key={i + "-" + k} className="b in">{m}</div>)}
              {typing && <div className="b in typing" aria-label="typing"><i /><i /><i /></div>}
            </div>
            <div className="input-row"><div className="field">{typed ? <span>{typed}</span> : <span className="ph">{s.who === "Unknown" ? "Message" : `Message ${s.who}`}</span>}<i className="caret" /></div></div>
            <div className="kb">
              <div key={cardKey} className={`smart ${showCard ? "glow" : "swap"}`}>{showCard ? s.card : null}</div>
              <div className="toolbar">
                {[["pay", "Pay"], ["split", "Split"], ["ai", "Shield"], ["cal", "Plan"], ["tr", "Translate"]].map(([k, l]) => (
                  <div key={k} className={`tool ${s.tool === k ? "on" : ""}`}>{l}</div>
                ))}
              </div>
              {ROWS.map((r, ri) => (
                <div className="row" key={r}>
                  {ri === 2 && <div className="k fn">⇧</div>}
                  {[...r].map((c) => <div key={c} className={`k ${down === c ? "down" : ""}`}>{c}</div>)}
                  {ri === 2 && <div className="k fn">⌫</div>}
                </div>
              ))}
              <div className="row"><div className="k fn">123</div><div className="k mly">m</div><div className={`k space ${down === " " ? "down" : ""}`}>space</div><div className="k fn ret">⏎</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
