"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseIntent, type Intent } from "@/lib/intent";
import { api } from "./api";
import { money, ConfirmPayment } from "./Widgets";

type Friend = { handle: string; name: string; emoji: string; opener: string; address?: string };
type Msg = { from: "me" | "them"; text: string; link?: string };
type Result =
  | { kind: "sent"; text: string }
  | { kind: "confirm"; id: number; amount: number; to: string; reason: string }
  | { kind: "blocked"; reasons: string[]; typed?: string; twin?: string | null }
  | { kind: "split"; title: string; shares: { label: string; amount_cents: number; token: string; is_owner: number }[] }
  | { kind: "link"; verdict: string; reasons: string[]; source: string; testUrl?: string | null; kaneError?: string }
  | { kind: "address"; findings: { level: string; message: string }[]; typed: string; twin: string | null };

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Ai = { text: string; intent: Intent; source: "model" | "rules" };

export default function Pad({ friends, me, aiModel }: { friends: Friend[]; me: string; aiModel: string | null }) {
  const router = useRouter();
  const [fi, setFi] = useState(0);
  const friend = friends[fi];
  const [threads, setThreads] = useState<Record<string, Msg[]>>(() => Object.fromEntries(friends.map((f) => [f.handle, [{ from: "them", text: f.opener }]])));
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [down, setDown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgs = threads[friend.handle];

  // What the keyboard suggests: from what you're typing first, otherwise from their last message.
  const lastTheirs = [...msgs].reverse().find((m) => m.from === "them")?.text ?? "";
  // When the patterns can't read a message, the language model gets a go (debounced).
  const [ai, setAi] = useState<Ai | null>(null);
  const [thinking, setThinking] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  useEffect(() => {
    const t = text.trim();
    if (!aiModel || t.length < 8 || parseIntent(t).kind !== "none" || !/\d|\$|https?:|send|pay|owe|split/i.test(t)) { setThinking(false); return; }
    if (ai?.text === t) return;
    setThinking(true);
    const ctl = new AbortController();
    const h = setTimeout(async () => {
      try {
        const r = await fetch("/api/ai/intent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: t, from: "me" }), signal: ctl.signal });
        const d = await r.json();
        if (r.ok) setAi({ text: t, intent: d.intent, source: d.source });
      } catch {} finally { if (!ctl.signal.aborted) setThinking(false); }
    }, 650);
    return () => { clearTimeout(h); ctl.abort(); };
  }, [text, aiModel]); // eslint-disable-line react-hooks/exhaustive-deps

  const typedIntent: Intent = useMemo(() => {
    const t = text.trim();
    const rules = parseIntent(t);
    if (rules.kind !== "none") return rules;
    return ai && ai.text === t ? ai.intent : { kind: "none" };
  }, [text, ai]);
  const fromModel = typedIntent.kind !== "none" && parseIntent(text.trim()).kind === "none";

  const intent: Intent = useMemo(() => {
    const mine = typedIntent;
    if (mine.kind !== "none") return mine;
    const theirs = parseIntent(lastTheirs);
    return theirs.kind === "split" || theirs.kind === "request" || theirs.kind === "link" || theirs.kind === "address" ? theirs : { kind: "none" };
  }, [typedIntent, lastTheirs]);

  // A new chat clears the card. A new suggestion clears it too, except a success message,
  // which stays until the user starts typing again.
  useEffect(() => { setResult(null); }, [fi]);
  useEffect(() => { setResult((r) => (r?.kind === "sent" && text === "" ? r : null)); }, [intent.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (m: Msg) => setThreads((t) => ({ ...t, [friend.handle]: [...t[friend.handle], m] }));
  const press = (c: string) => { setDown(c); setTimeout(() => setDown(null), 110); };

  async function act() {
    setBusy(true);
    try {
      if (intent.kind === "split") {
        const others = friends.filter((f) => f.handle !== friend.handle).map((f) => f.handle);
        const names = intent.names.length ? intent.names : [friend.handle, ...others].slice(0, Math.max(1, intent.people - 1));
        const r = await api("/api/splits", "POST", { title: `Split with ${friend.name.split(" ")[0]}`, total: intent.totalCents / 100, people: names });
        if (!r.ok) setResult({ kind: "blocked", reasons: [r.data.error ?? "Couldn’t create the split."] });
        else {
          setResult({ kind: "split", title: r.data.title, shares: r.data.shares });
          const mine = r.data.shares.find((s: any) => s.label === friend.handle);
          if (mine) push({ from: "me", text: `Your share is ${money(mine.amount_cents)}. Pay here:`, link: `/pay/${mine.token}` });
          setText("");
        }
      } else if (intent.kind === "pay" || intent.kind === "request") {
        let to = intent.kind === "pay" ? intent.to : "@" + friend.handle;
        const amount = intent.amountCents / 100;
        const r = await api("/api/pay", "POST", { to, amount, note: intent.kind === "pay" ? intent.note : `Requested in chat` });
        const d = r.data;
        if (d.to) to = d.to;
        if (d.status === "sent") { setResult({ kind: "sent", text: `Sent ${money(intent.amountCents)} to ${to}.` }); push({ from: "me", text: `Sent you ${money(intent.amountCents)} ✓` }); setText(""); }
        else if (d.status === "needs_confirmation") setResult({ kind: "confirm", id: d.paymentId, amount: intent.amountCents, to, reason: d.reasons.join(" ") });
        else {
          let twin: string | null = null; let typed: string | undefined;
          if (d.findings?.some((f: any) => f.code === "lookalike")) {
            typed = intent.kind === "pay" ? intent.to : undefined;
            if (typed) twin = (await api("/api/shield/address", "POST", { address: typed })).data.twin;
          }
          setResult({ kind: "blocked", reasons: d.reasons ?? [d.error], typed, twin });
        }
        router.refresh();
      } else if (intent.kind === "address") {
        const r = await api("/api/shield/address", "POST", { address: intent.address });
        setResult({ kind: "address", findings: r.data.findings, typed: intent.address, twin: r.data.twin });
      } else if (intent.kind === "link") {
        const r = await api("/api/shield/link", "POST", { url: intent.url, deep: false });
        setResult(r.ok ? { kind: "link", ...r.data } : { kind: "blocked", reasons: [r.data.error] });
      }
    } finally { setBusy(false); }
  }

  async function deepScan(url: string) {
    setBusy(true);
    const r = await api("/api/shield/link", "POST", { url, deep: true });
    setBusy(false);
    setResult(r.ok ? { kind: "link", ...r.data } : { kind: "blocked", reasons: [r.data.error] });
  }

  function sendText(e?: React.FormEvent) {
    e?.preventDefault();
    if (!text.trim()) return;
    if (intent.kind !== "none" && typedIntent.kind !== "none") return void act();
    push({ from: "me", text }); setText("");
  }

  async function tone(t: "tidy" | "warm" | "brief") {
    if (!text.trim()) return;
    setRewriting(t);
    const r = await api("/api/ai/rewrite", "POST", { text, tone: t });
    setRewriting(null);
    if (r.ok) { setText(r.data.text); inputRef.current?.focus(); }
  }

  const card = (() => {
    if (result) {
      switch (result.kind) {
        case "sent": return (<><div className="smart-top"><span className="chip">Paid</span>Shield checked</div><div className="smart-title" data-testid="pad-sent">{result.text}</div></>);
        case "confirm": return (<><div className="smart-top"><span className="chip grey">Limit</span>Needs your confirmation</div>
          <ConfirmPayment id={result.id} amount={result.amount} to={result.to} reason={result.reason} onDone={() => { setResult({ kind: "sent", text: `Sent ${money(result.amount)} to ${result.to}.` }); push({ from: "me", text: `Sent you ${money(result.amount)} ✓` }); setText(""); }} /></>);
        case "blocked": return (<><div className="smart-top"><span className="chip warn">Shield</span>Payment stopped</div>
          <div className="smart-title" data-testid="pad-blocked">Not sent</div>
          <div className="smart-sub">{result.reasons.join(" ")}</div>
          {result.twin && result.typed && <div className="addr" style={{ marginTop: 6 }}>{[...result.typed].map((c, i) => <span key={i} className={c !== result.twin![i] ? "x" : ""}>{c}</span>)}</div>}</>);
        case "address": {
          const block = result.findings.find((f) => f.level === "block"); const warn = result.findings.find((f) => f.level === "warn");
          return (<><div className="smart-top"><span className={`chip ${block || warn ? "warn" : ""}`}>Shield</span>Address check</div>
            <div className="smart-title" data-testid="pad-address">{block ? "Don’t send to this address" : warn ? "New address, check it first" : "Address looks right"}</div>
            <div className="smart-sub">{result.findings.map((f) => f.message).join(" ")}</div>
            {result.twin && <div className="addr" style={{ marginTop: 6 }}>{[...result.typed].map((c, i) => <span key={i} className={c !== result.twin![i] ? "x" : ""}>{c}</span>)}</div>}</>);
        }
        case "link": return (<><div className="smart-top"><span className={`chip ${result.verdict === "safe" ? "" : "warn"}`}>Shield</span>{result.source === "kane" ? "Opened by Kane in a real browser" : "Quick check"}</div>
          <div className="smart-title" data-testid="pad-link">{result.verdict === "safe" ? "Link looks safe" : result.verdict === "risky" ? "Be careful with this link" : "Don’t open this link"}</div>
          <div className="smart-sub">{result.reasons.join(" ")}{result.kaneError ? ` Deep scan unavailable: ${result.kaneError}` : ""}</div>
          {result.source !== "kane" && intent.kind === "link" && <div className="smart-actions"><button className="btn btn-teal" disabled={busy} onClick={() => deepScan(intent.url)}>{busy ? "Kane is opening it…" : "Deep scan with Kane"}</button></div>}
          {result.testUrl && <a className="sub" href={result.testUrl} target="_blank" rel="noreferrer" style={{ color: "var(--teal-ink)" }}>See Kane’s evidence</a>}</>);
        case "split": return (<><div className="smart-top"><span className="chip">Split</span>Links created</div>
          <div className="smart-title" data-testid="pad-split">{money(result.shares.find((s) => !s.is_owner)?.amount_cents ?? 0)} each</div>
          <div className="people">{result.shares.map((s) => <div key={s.token} className={`person ${s.is_owner ? "paid" : ""}`}><b>{s.is_owner ? "You" : s.label}</b>{s.is_owner ? "covered" : "link sent"}</div>)}</div></>);
      }
    }
    switch (intent.kind) {
      case "split": return (<><div className="smart-top"><span className="chip">Split</span>{intent.people} people{fromModel && <ModelTag />}</div>
        <div className="smart-title">{money(Math.floor(intent.totalCents / intent.people))} each</div>
        <div className="smart-sub">Creates a payment link for each person and tracks who has paid.</div>
        <div className="smart-actions"><button className="btn btn-ink" disabled={busy} onClick={act}>{busy ? "Creating…" : "Create split links"}</button></div></>);
      case "pay": return (<><div className="smart-top"><span className="chip">Pay</span>Shield checks first{fromModel && <ModelTag />}</div>
        <div className="smart-title">Send {money(intent.amountCents)} to {intent.to.length > 20 ? intent.to.slice(0, 6) + "…" + intent.to.slice(-4) : intent.to.replace(/^@?/, "@")}</div>
        {intent.note && <div className="smart-sub">For {intent.note}</div>}
        <div className="smart-actions"><button className="btn btn-teal" disabled={busy} onClick={act}>{busy ? "Sending…" : `Pay ${money(intent.amountCents)}`}</button></div></>);
      case "request": return (<><div className="smart-top"><span className="chip">Pay on reply</span>{friend.name.split(" ")[0]} asked for money</div>
        <div className="smart-title">Send {money(intent.amountCents)} to @{friend.handle}</div>
        <div className="smart-actions"><button className="btn btn-teal" disabled={busy} onClick={act}>{busy ? "Sending…" : `Pay ${money(intent.amountCents)}`}</button></div></>);
      case "address": return (<><div className="smart-top"><span className="chip warn">Shield</span>Address in chat</div>
        <div className="smart-title">Check this address before paying</div>
        <div className="smart-actions"><button className="btn btn-ink" disabled={busy} onClick={act}>{busy ? "Checking…" : "Check address"}</button></div></>);
      case "link": return (<><div className="smart-top"><span className="chip warn">Shield</span>Link in chat</div>
        <div className="smart-title">Check this link before opening</div>
        <div className="smart-actions"><button className="btn btn-ink" disabled={busy} onClick={act}>{busy ? "Checking…" : "Quick check"}</button><button className="btn btn-teal" disabled={busy} onClick={() => deepScan(intent.url)}>Deep scan with Kane</button></div></>);
      default: return thinking
        ? (<><div className="smart-top"><span className="chip grey">Claude</span>Reading your message</div>
          <div className="smart-title quiet" aria-live="polite"><span className="typing" aria-hidden><i /><i /><i /></span></div></>)
        : (<><div className="smart-top"><span className="chip grey">Mlyfo</span>{aiModel ? "Claude reads what you type" : "Ready"}</div>
          <div className="smart-title quiet">{aiModel ? <>Write it how you’d say it: “can you cover half the cab, it was 18”, or paste an address or link.</> : <>Type “split 60 / 3”, “pay @{friend.handle} 20 for lunch” or paste an address or link.</>}</div></>);
    }
  })();

  return (
    <div className="pad">
      <div className="pad-chat">
        <div className="chat-head"><div className="ava">{friend.emoji}</div><div><b>{friend.name}</b><small>@{friend.handle}</small></div></div>
        <div className="msgs" data-testid="pad-messages">
          {msgs.map((m, k) => (
            <div key={k} className={`b ${m.from === "me" ? "out" : "in"}`}>{m.text}{m.link && <> <a href={m.link} style={{ textDecoration: "underline" }}>{(typeof location !== "undefined" ? location.host : "") + m.link}</a></>}</div>
          ))}
        </div>
        <form className="pad-input" onSubmit={sendText}>
          <input ref={inputRef} aria-label="Message" data-testid="pad-input" placeholder={`Message ${friend.name.split(" ")[0]}`} value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => press(e.key.toLowerCase())} />
          <button className="btn btn-ink btn-sm">Send</button>
        </form>
        <div className="kb">
          <div className="smart glow" key={intent.kind + (result?.kind ?? "")} data-testid="smart-card">{card}</div>
          {aiModel && (
            <div className="toolbar" role="group" aria-label="Rewrite with Claude">
              {(["tidy", "warm", "brief"] as const).map((t) => (
                <button type="button" key={t} className="tool" disabled={!text.trim() || !!rewriting} onClick={() => tone(t)}>
                  {rewriting === t ? "Rewriting…" : t === "tidy" ? "Tidy" : t === "warm" ? "Warmer" : "Shorter"}
                </button>
              ))}
            </div>
          )}
          {ROWS.map((r, ri) => (
            <div className="row" key={r}>
              {ri === 2 && <div className="k fn">⇧</div>}
              {[...r].map((c) => <button type="button" key={c} className={`k ${down === c ? "down" : ""}`} style={{ border: 0, cursor: "pointer" }} tabIndex={-1}
                onClick={() => { setText((t) => t + c); press(c); inputRef.current?.focus(); }}>{c}</button>)}
              {ri === 2 && <button type="button" tabIndex={-1} className="k fn" style={{ border: 0, cursor: "pointer" }} onClick={() => setText((t) => t.slice(0, -1))}>⌫</button>}
            </div>
          ))}
          <div className="row"><div className="k fn">123</div><div className="k mly">m</div>
            <button type="button" tabIndex={-1} className={`k space ${down === " " ? "down" : ""}`} style={{ border: 0, cursor: "pointer" }} onClick={() => setText((t) => t + " ")}>space</button>
            <button type="button" tabIndex={-1} className="k fn ret" style={{ border: 0, cursor: "pointer" }} onClick={() => sendText()}>⏎</button></div>
        </div>
      </div>

      <div>
        <div className="c">
          <h3>Chats</h3>
          <div className="scen" style={{ marginTop: 10 }}>
            {friends.map((f, k) => (
              <button key={f.handle} aria-pressed={k === fi} onClick={() => setFi(k)} data-testid={`chat-${f.handle}`}>
                <span className="em">{f.emoji}</span><span>{f.name.split(" ")[0]}<small style={{ display: "block", color: "var(--mute)", fontSize: 13 }}>{threads[f.handle].at(-1)!.text.slice(0, 40)}</small></span><span className="tag">@{f.handle}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="c" style={{ marginTop: 18 }}>
          <h3>Try typing</h3>
          <div className="suggest">
            {[`split 236 / 4`, `pay @${friend.handle} 20 for lunch`, `pay @${friend.handle} 150 for rent`, `send 10 usdc to AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx`].map((s) => (
              <button key={s} onClick={() => { setText(s); inputRef.current?.focus(); }}>{s.length > 34 ? s.slice(0, 34) + "…" : s}</button>
            ))}
          </div>
          <p className="sub" style={{ marginTop: 14 }}>Signed in as @{me}. Payments use demo USDC.</p>
          <p className="sub model-line">{aiModel ? <>Messages the patterns can’t read go to <b>{aiModel}</b>. Its answer is only a suggestion: Shield and your limits still check every payment.</> : <>The AI model is off on this server, so only the built-in patterns read messages.</>}</p>
        </div>
      </div>
    </div>
  );
}

function ModelTag() {
  return <span className="model-tag" title="Suggested by Claude">Read by Claude</span>;
}
