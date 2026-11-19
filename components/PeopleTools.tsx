"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import Icon from "./Icon";

/** Add someone by @username, or by name and wallet address. Shield checks the address before it is saved. */
export function AddPerson() {
  const router = useRouter();
  const [mode, setMode] = useState<"handle" | "address">("handle");
  const [handle, setHandle] = useState("");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const r = await api("/api/contacts", "POST", mode === "handle" ? { handle, label } : { label, address });
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? "Couldn’t save this person." }); return; }
    setMsg({ ok: true, text: `Saved ${r.data.label}.` });
    setHandle(""); setLabel(""); setAddress(""); router.refresh();
  }

  return (
    <form onSubmit={save} className="person-form" data-testid="add-person">
      <div className="seg" role="tablist" aria-label="How to add them">
        <button type="button" role="tab" aria-selected={mode === "handle"} onClick={() => setMode("handle")}>On Mlyfo</button>
        <button type="button" role="tab" aria-selected={mode === "address"} onClick={() => setMode("address")}>Any wallet</button>
      </div>
      {mode === "handle" ? (
        <div className="row-form">
          <input aria-label="Mlyfo username" placeholder="@username" value={handle} onChange={(e) => setHandle(e.target.value)} required />
          <input aria-label="Name" placeholder="Name (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn btn-ink btn-sm" disabled={busy}>{busy ? "Saving…" : "Save person"}</button>
        </div>
      ) : (
        <div className="row-form">
          <input aria-label="Name" placeholder="Name" value={label} onChange={(e) => setLabel(e.target.value)} required style={{ maxWidth: 180 }} />
          <input aria-label="Solana address" placeholder="Solana address" value={address} onChange={(e) => setAddress(e.target.value)} required />
          <button className="btn btn-ink btn-sm" disabled={busy}>{busy ? "Checking…" : "Save person"}</button>
        </div>
      )}
      <p className="hint">{mode === "handle" ? "Their wallet comes from their own Mlyfo account, so it can’t be mistyped." : "Shield checks the address first. Look-alikes of someone you’ve saved and known scam addresses are refused."}</p>
      {msg && <div className={`mini ${msg.ok ? "ok" : "warn"}`} role={msg.ok ? "status" : "alert"} data-testid="person-result"><Icon name={msg.ok ? "check" : "alert"} /><span>{msg.text}</span></div>}
    </form>
  );
}

/** Create a private link that asks someone to confirm their own wallet. */
export function AskForAddress() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  return (
    <form className="row-form" onSubmit={async (e) => {
      e.preventDefault(); setErr(""); setCopied(false);
      const r = await api("/api/people/ask", "POST", { label });
      if (!r.ok) { setErr(r.data.error); return; }
      setLink(location.origin + r.data.path); setLabel(""); router.refresh();
    }}>
      <input aria-label="Who are you asking" placeholder="Their name, e.g. Mum" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <button className="btn btn-teal btn-sm">Create link</button>
      {link && <div className="ask-link"><span className="addr">{link}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button></div>}
      {err && <div className="err" role="alert">{err}</div>}
    </form>
  );
}

export function RemovePerson({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  return <button className="btn btn-ghost btn-sm" aria-label={`Remove ${name}`} onClick={async () => { await api(`/api/contacts?id=${id}`, "DELETE"); router.refresh(); }}>Remove</button>;
}

/** On the ask page: the person being asked confirms their wallet. */
export function ConfirmAddress({ token, asker, address }: { token: string; asker: string; address: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <div className="mini ok" data-testid="ask-done"><Icon name="check" /><span><b>Confirmed.</b> @{asker} can now pay you without anyone pasting an address.</span></div>;
  return (
    <div style={{ marginTop: 20 }}>
      <div className="sub">Your wallet</div>
      <div className="addr" style={{ marginTop: 4 }}>{address}</div>
      <button className="btn btn-ink btn-full" style={{ marginTop: 16 }} disabled={state === "busy"} onClick={async () => {
        setState("busy"); setErr("");
        const r = await api(`/api/people/ask/${token}`, "POST");
        if (r.ok) setState("done"); else { setErr(r.data.error); setState("idle"); }
      }}>{state === "busy" ? "Confirming…" : `Share my wallet with @${asker}`}</button>
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  );
}

/** Dashboard: link your own wallet. Friends see a warning for 7 days after a change. */
export function LinkWallet({ current }: { current: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!open) return <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>Link your own wallet</button>;
  return (
    <form style={{ marginTop: 12 }} onSubmit={async (e) => {
      e.preventDefault(); setMsg(null);
      const r = await api("/api/settings", "PATCH", { address });
      if (!r.ok) { setMsg({ ok: false, text: r.data.error }); return; }
      setMsg({ ok: true, text: "Wallet linked. Friends paying you will see that it changed for the next 7 days." }); setAddress(""); router.refresh();
    }}>
      <div className="row-form">
        <input aria-label="Your wallet address" placeholder={current.slice(0, 6) + "…"} value={address} onChange={(e) => setAddress(e.target.value)} required />
        <button className="btn btn-ink btn-sm">Link wallet</button>
      </div>
      {msg && <div className={`mini ${msg.ok ? "ok" : "warn"}`} role={msg.ok ? "status" : "alert"}><Icon name={msg.ok ? "check" : "alert"} /><span>{msg.text}</span></div>}
    </form>
  );
}
