"use client";
import Avatar from "./Avatar";
import Link from "next/link";
import { ChainStatus, CountUp } from "./ReceiptTools";
import { Tick } from "./Receipt";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseIntent, type Intent } from "@/lib/intent";
import { api } from "./api";
import { money, ConfirmPayment } from "./Widgets";

/** A chat. Demo friends come with a scripted first message; your saved people start empty. */
type Friend = { key: string; handle: string; name: string; opener: string; payTo: string; splitName: string; saved?: boolean };
type Choice = { to: string; label: string; detail: string };
type Paid = { cents: number; receiptId?: string; delivered?: string };
type Msg = { from: "me" | "them"; text: string; link?: string; paid?: Paid };
type Receipt = { receiptId?: string; toAddress?: string; deliveredTo?: string | null };
type Result =
  | ({ kind: "sent"; text: string; cents: number; to: string } & Receipt)
  | { kind: "sending"; cents: number; to: string; left: number }
  | { kind: "confirm"; id: number; amount: number; to: string; reason: string }
  | { kind: "blocked"; reasons: string[]; typed?: string; twin?: string | null; choices?: Choice[]; amount?: number; note?: string }
  | { kind: "split"; title: string; shares: { label: string; amount_cents: number; token: string; is_owner: number }[] }
  | { kind: "link"; verdict: string; reasons: string[]; source: string; testUrl?: string | null; kaneError?: string }
  | { kind: "address"; findings: { level: string; message: string }[]; typed: string; twin: string | null };

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

type Ai = { text: string; intent: Intent; source: "model" | "rules" };

export default function Pad({ friends, me, aiModel, initialText }: { friends: Friend[]; me: string; aiModel: string | null; initialText?: string }) {
  const router = useRouter();
  const [fi, setFi] = useState(0);
  const [screen, setScreen] = useState<"list" | "chat">("chat");
  const msgsRef = useRef<HTMLDivElement>(null);
  const friend = friends[fi];
  const [threads, setThreads] = useState<Record<string, Msg[]>>(() => Object.fromEntries(friends.map((f) => [f.key, f.opener ? [{ from: "them", text: f.opener }] : []])));
  // Text handed over from the Android keyboard (/k?text=…) arrives already typed.
  const [text, setText] = useState(initialText ?? "");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [down, setDown] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const msgs = threads[friend.key] ?? [];

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
  useEffect(() => { setResult(null); setText(""); }, [fi]);
  useEffect(() => { setResult((r) => (r?.kind === "sent" && text === "" ? r : null)); }, [intent.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = (m: Msg) => setThreads((t) => ({ ...t, [friend.key]: [...(t[friend.key] ?? []), m] }));
  const press = (c: string) => { setDown(c); setTimeout(() => setDown(null), 110); };

  /** Money moved: turn the card into a receipt and drop a payment bubble into the chat. */
  function paidOut(cents: number, to: string, d: { receipt_id?: string; to_address?: string; delivered_to?: string | null }) {
    const delivered = d.delivered_to ? `Delivered to @${d.delivered_to}` : d.to_address ? `Sent to wallet ${d.to_address.slice(0, 4)}…${d.to_address.slice(-4)}` : undefined;
    setResult({ kind: "sent", text: `Sent ${money(cents)} to ${to}.`, cents, to, receiptId: d.receipt_id, toAddress: d.to_address, deliveredTo: d.delivered_to });
    push({ from: "me", text: `Sent you ${money(cents)} ✓`, paid: { cents, receiptId: d.receipt_id, delivered } });
    setText("");
  }

  // A 5-second window to take a one-tap payment back before any money moves.
  const undoRef = useRef<{ timer: ReturnType<typeof setInterval>; cancel: () => void } | null>(null);
  function undo() { undoRef.current?.cancel(); }
  function countdown(cents: number, to: string): Promise<boolean> {
    return new Promise((resolve) => {
      let left = 5;
      setResult({ kind: "sending", cents, to, left });
      const timer = setInterval(() => {
        left -= 1;
        if (left <= 0) { clearInterval(timer); undoRef.current = null; resolve(true); }
        else setResult({ kind: "sending", cents, to, left });
      }, 1000);
      undoRef.current = { timer, cancel: () => { clearInterval(timer); undoRef.current = null; setResult(null); resolve(false); } };
    });
  }
  useEffect(() => () => { if (undoRef.current) clearInterval(undoRef.current.timer); }, []);

  /** Send money. "target" is "@handle", a saved contact's name or an address. */
  async function pay(target: string, amountCents: number, note: string) {
    let to = target;
    if (!(await countdown(amountCents, target.length > 20 ? target.slice(0, 4) + "…" + target.slice(-4) : target))) return;
    const r = await api("/api/pay", "POST", { to, amount: amountCents / 100, note });
    const d = r.data;
    if (d.to) to = d.to;
    if (d.status === "sent") paidOut(amountCents, to, d);
    else if (d.status === "needs_confirmation") setResult({ kind: "confirm", id: d.paymentId, amount: amountCents, to, reason: d.reasons.join(" ") });
    else {
      let twin: string | null = null; let typed: string | undefined;
      if (d.findings?.some((f: any) => f.code === "lookalike")) {
        typed = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(target) ? target : undefined;
        if (typed) twin = (await api("/api/shield/address", "POST", { address: typed })).data.twin;
      }
      setResult({ kind: "blocked", reasons: d.reasons ?? [d.error], typed, twin, choices: d.choices, amount: amountCents, note });
    }
    router.refresh();
  }

  async function act() {
    setBusy(true);
    try {
      if (intent.kind === "split") {
        const others = friends.filter((f) => f.key !== friend.key).map((f) => f.splitName);
        const names = intent.names.length ? intent.names : [friend.splitName, ...others].slice(0, Math.max(1, intent.people - 1));
        const r = await api("/api/splits", "POST", { title: `Split with ${friend.name.split(" ")[0]}`, total: intent.totalCents / 100, people: names });
        if (!r.ok) setResult({ kind: "blocked", reasons: [r.data.error ?? "Couldn’t create the split."] });
        else {
          setResult({ kind: "split", title: r.data.title, shares: r.data.shares });
          const mine = r.data.shares.find((s: any) => s.label === friend.splitName);
          if (mine) push({ from: "me", text: `Your share is ${money(mine.amount_cents)}. Pay here:`, link: `/pay/${mine.token}` });
          setText("");
        }
      } else if (intent.kind === "pay" || intent.kind === "request") {
        await pay(intent.kind === "pay" ? intent.to : friend.payTo, intent.amountCents, intent.kind === "pay" ? intent.note : "Requested in chat");
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
        case "sending": return (<><div className="smart-top"><span className="chip grey">Sending</span>Money moves in {result.left}s</div>
          <div className="smart-title">Sending {money(result.cents)} to {result.to}</div>
          <div className="undo-bar" aria-hidden><i style={{ animationDuration: "5s" }} /></div>
          <div className="smart-actions"><button className="btn btn-ghost" onClick={undo} data-testid="undo">Undo</button></div></>);
        case "sent": return (<><div className="smart-top"><span className="chip">Paid</span>Shield checked{result.receiptId && <span className="rcpt-id num">{result.receiptId}</span>}</div>
          <div className="smart-title" data-testid="pad-sent">{result.text}</div>
          <div className="smart-sub">{result.deliveredTo ? <>Delivered to @{result.deliveredTo}. It’s in their balance now</> : result.toAddress ? <>Sent to wallet <span className="num">{result.toAddress.slice(0, 4)}…{result.toAddress.slice(-4)}</span></> : null}</div>
          {result.receiptId && <div className="rcpt-actions"><ChainStatus id={result.receiptId} compact /><a className="rcpt-link" href={`/r/${result.receiptId}`} target="_blank" rel="noreferrer">View receipt</a></div>}</>);
        case "confirm": return (<><div className="smart-top">{result.reason.includes("changed their wallet") ? <span className="chip warn">Shield</span> : <span className="chip grey">Limit</span>}Needs your confirmation</div>
          <ConfirmPayment id={result.id} amount={result.amount} to={result.to} reason={result.reason} onDone={(d) => paidOut(result.amount, result.to, d)} /></>);
        case "blocked": return (<><div className="smart-top">{result.choices ? <><span className="chip">Pay</span>Two people match this name</> : <><span className="chip warn">Shield</span>Payment stopped</>}</div>
          <div className="smart-title" data-testid="pad-blocked">{result.choices ? "Who did you mean?" : "Not sent"}</div>
          <div className="smart-sub">{result.reasons.join(" ")}</div>
          {result.twin && result.typed && <div className="addr" style={{ marginTop: 6 }}>{[...result.typed].map((c, i) => <span key={i} className={c !== result.twin![i] ? "x" : ""}>{c}</span>)}</div>}
          {result.choices && result.amount && <div className="choices" data-testid="pay-choices">{result.choices.map((c) => (
            <button key={c.to} type="button" className="choice" disabled={busy} onClick={async () => { setBusy(true); try { await pay(c.to, result.amount!, result.note ?? ""); } finally { setBusy(false); } }}>
              <b>{c.label}</b><span className="addr">{c.detail}</span></button>))}</div>}</>);
        case "address": {
          const block = result.findings.find((f) => f.level === "block"); const warn = result.findings.find((f) => f.level === "warn");
          return (<><div className="smart-top"><span className={`chip ${block || warn ? "warn" : ""}`}>Shield</span>Address check</div>
            <div className="smart-title" data-testid="pad-address">{block ? "Don’t send to this address" : warn ? "New address, check it first" : "Address looks right"}</div>
            <div className="smart-sub">{result.findings.map((f) => f.message).join(" ")}</div>
            {result.twin && <div className="addr" style={{ marginTop: 6 }}>{[...result.typed].map((c, i) => <span key={i} className={c !== result.twin![i] ? "x" : ""}>{c}</span>)}</div>}
            {!block && warn && <SaveContact address={result.typed} onSaved={(n) => { push({ from: "me", text: `Saved ${n} to my people ✓` }); router.refresh(); }} />}</>);
        }
        case "link": return (<><div className="smart-top"><span className={`chip ${result.verdict === "safe" ? "" : "warn"}`}>Shield</span>{result.source === "kane" ? "Opened by Kane in a real browser" : result.source === "kane-recorded" ? "Recorded by Kane in a real browser" : "Quick check"}</div>
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
        <div className="smart-title">Send {money(intent.amountCents)} to {intent.to.length > 20 ? intent.to.slice(0, 6) + "…" + intent.to.slice(-4) : intent.to}</div>
        {intent.note && <div className="smart-sub">For {intent.note}</div>}
        <div className="smart-actions"><button className="btn btn-teal" disabled={busy} onClick={act}>{busy ? "Sending…" : `Pay ${money(intent.amountCents)}`}</button></div></>);
      case "request": return (<><div className="smart-top"><span className="chip">Pay on reply</span>{friend.name.split(" ")[0]} asked for money</div>
        <div className="smart-title">Send {money(intent.amountCents)} to {friend.payTo}</div>
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
          <div className="smart-title quiet">{aiModel ? <>Write it how you’d say it: “can you cover half the cab, it was 18”, or paste an address or link.</> : <>Type “split 60 / 3”, “pay {friend.payTo} 20 for lunch” or paste an address or link.</>}</div></>);
    }
  })();

  useEffect(() => { msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight }); }, [msgs.length, screen, fi]);

  const tries = [`split 236 / 4`, `pay ${friend.payTo} 20 for lunch`, `pay ${friend.payTo} 150 for rent`, `send 10 usdc to AdaK9zXw2LmQ8rTvB3nYc7HsP4kJe6FgD1oWu5Ra2Fx`];
  const key = (c: string, extra = "") => (
    <button type="button" key={c} tabIndex={-1} className={`k ${extra} ${down === c ? "down" : ""}`}
      onClick={() => { setText((t) => t + c); press(c); inputRef.current?.focus(); }}>{c}</button>
  );

  return (
    <div className="pad-stage">
      <div className="phone dark pad-phone">
        <div className="screen">
          <div className="island" />
          <div className="status"><span>9:41</span><span>5G 87%</span></div>

          {screen === "list" ? (
            <div className="chatlist">
              <h2 className="chatlist-title">Messages</h2>
              {friends.map((f, k) => (
                <button key={f.key} className="chatlist-row" onClick={() => { setFi(k); setScreen("chat"); }} data-testid={`chat-${f.key}`}>
                  <Avatar name={f.name} />
                  <span className="chatlist-text"><b>{f.name.split(" ")[0]}</b><small>{threads[f.key]?.at(-1)?.text ?? (f.saved ? "Saved person. Say hi or send money" : "")}</small></span>
                </button>
              ))}
              <Link href="/app/people" className="chatlist-add">+ Add someone</Link>
            </div>
          ) : (<>
            <div className="chat-head">
              <button type="button" className="back" onClick={() => setScreen("list")} aria-label="All chats">‹</button>
              <div className="who"><Avatar name={friend.name} /><span className="name-pill">{friend.name.split(" ")[0]} ›</span></div>
              <span className="back-spacer" />
            </div>
            <div className="msgs" ref={msgsRef} data-testid="pad-messages">
              {msgs.map((m, k) => (
                m.paid ? (
                  <div key={k} className="b out paybubble" data-testid="pay-bubble">
                    <span className="pb-amt num"><CountUp cents={m.paid.cents} /></span>
                    <span className="pb-state">Paid <Tick /></span>
                    {m.paid.delivered && <span className="pb-meta">{m.paid.delivered}</span>}
                    {m.paid.receiptId && <a className="pb-link" href={`/r/${m.paid.receiptId}`} target="_blank" rel="noreferrer">View receipt</a>}
                  </div>
                ) : <div key={k} className={`b ${m.from === "me" ? "out" : "in"}`}>{m.text}{m.link && <> <a href={m.link}>{(typeof location !== "undefined" ? location.host : "") + m.link}</a></>}</div>
              ))}
            </div>
            <form className="input-row" onSubmit={sendText}>
              <input ref={inputRef} className="field" aria-label="Message" data-testid="pad-input" placeholder={`Message ${friend.name.split(" ")[0]}`} value={text}
                onChange={(e) => setText(e.target.value)} onKeyDown={(e) => press(e.key.toLowerCase())} />
              <button className="send" aria-label="Send" disabled={!text.trim()}>↑</button>
            </form>
            <div className="kb">
              <div className={`smart glow ${result?.kind === "sent" || result?.kind === "split" ? "settled perf" : ""}`} key={intent.kind + (result?.kind ?? "")} data-testid="smart-card">{card}</div>
              <div className="chips" role="group" aria-label="Try typing">
                {tries.map((t) => <button type="button" key={t} onClick={() => { setText(t); inputRef.current?.focus(); }}>{t.length > 26 ? t.slice(0, 24) + "…" : t}</button>)}
              </div>
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
                  {[...r].map((c) => key(c))}
                  {ri === 2 && <button type="button" tabIndex={-1} className="k fn" aria-label="Delete" onClick={() => setText((t) => t.slice(0, -1))}>⌫</button>}
                </div>
              ))}
              <div className="row"><div className="k fn">123</div><div className="k mly">m</div>
                <button type="button" tabIndex={-1} className={`k space ${down === " " ? "down" : ""}`} onClick={() => setText((t) => t + " ")}>space</button>
                <button type="button" tabIndex={-1} className="k fn ret" aria-label="Send" onClick={() => sendText()}>⏎</button></div>
            </div>
          </>)}
        </div>
      </div>
      <aside className="pad-notes">
        <p className="pad-notes-lead">The Mlyfo keyboard, running in your browser. Every action is real: it moves demo USDC, creates links and runs Shield.</p>
        <p>Tap <b>‹</b> to see all chats. Each friend has sent you something the keyboard can act on.</p>
        <p>Signed in as @{me}. Payments use demo USDC.</p>
        <p className="model-line">{aiModel ? <>Messages the patterns can’t read go to <b>{aiModel}</b>. Its answer is only a suggestion: Shield and your limits still check every payment.</> : <>The AI model is off on this server, so only the built-in patterns read messages.</>}</p>
      </aside>
    </div>
  );
}

function ModelTag() {
  return <span className="model-tag" title="Suggested by Claude">Read by Claude</span>;
}

/** Offered when the keyboard checks an address you haven't saved. Shield still checks it again on save. */
function SaveContact({ address, onSaved }: { address: string; onSaved: (name: string) => void }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (msg?.ok) return <div className="smart-sub" role="status" style={{ marginTop: 8 }}>{msg.text}</div>;
  return (
    <form className="save-contact" onSubmit={async (e) => {
      e.preventDefault();
      const r = await api("/api/contacts", "POST", { label: name, address });
      if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Couldn’t save." }); return; }
      setMsg({ ok: true, text: `Saved as ${r.data.label}. Paying “${r.data.label}” now goes to this wallet.` }); onSaved(r.data.label);
    }}>
      <input aria-label="Contact name" placeholder="Save as… (name)" value={name} onChange={(e) => setName(e.target.value)} required />
      <button className="btn btn-ghost btn-sm">Save contact</button>
      {msg && !msg.ok && <div className="err" role="alert">{msg.text}</div>}
    </form>
  );
}
