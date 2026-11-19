"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { money } from "./Widgets";

export function NewSplit() {
  const router = useRouter();
  const [f, setF] = useState({ title: "", total: "", people: "" });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const names = f.people.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const each = names.length && Number(f.total) > 0 ? Math.floor((Number(f.total) * 100) / (names.length + 1)) : 0;
  return (
    <form data-testid="new-split" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      const r = await api("/api/splits", "POST", { title: f.title, total: f.total, people: names });
      setBusy(false);
      if (!r.ok) return setErr(r.data.error ?? "Couldn’t create the split.");
      setF({ title: "", total: "", people: "" }); router.refresh();
    }}>
      <div className="f"><label htmlFor="title">What’s it for?</label><input id="title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Dinner at Nonna’s" /></div>
      <div className="f"><label htmlFor="total">Total</label><input id="total" type="number" min={1} step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} placeholder="236" required /></div>
      <div className="f"><label htmlFor="people">Who’s paying you back?</label><input id="people" value={f.people} onChange={(e) => setF({ ...f, people: e.target.value })} placeholder="kabir, zoya, sofia" required />
        <div className="hint">Separate names with commas. You’re included automatically.</div></div>
      {each > 0 && <div className="ok-line">{names.length + 1} people, {money(each)} each.</div>}
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-ink btn-sm" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Creating…" : "Create split and links"}</button>
    </form>
  );
}

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn btn-ghost btn-sm" onClick={async () => {
      const url = `${location.origin}/pay/${token}`;
      try { await navigator.clipboard.writeText(url); } catch {}
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    }}>{copied ? "Copied" : "Copy link"}</button>
  );
}

export function PayShare({ token, amount, owner }: { token: string; amount: number; owner: string }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | "paid">(""); const [err, setErr] = useState("");
  if (state === "paid") return <div className="mini ok" data-testid="share-paid"><span>✓</span><span><b>Paid {money(amount)} to @{owner}.</b> They’ll see it in their split right away.</span></div>;
  return (<>
    <button className="btn btn-teal btn-full" style={{ marginTop: 20 }} disabled={state === "busy"} onClick={async () => {
      setState("busy"); setErr("");
      const r = await api(`/api/share/${token}`);
      if (r.ok && r.data.status === "sent") { setState("paid"); router.refresh(); return; }
      setState("");
      if (r.data.status === "needs_confirmation") { router.push("/app"); return; }
      setErr(r.data.error ?? r.data.reasons?.[0] ?? "Payment failed.");
    }}>{state === "busy" ? "Paying…" : `Pay ${money(amount)}`}</button>
    {err && <div className="err" role="alert">{err}</div>}
  </>);
}
