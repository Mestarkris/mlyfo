"use client";
import Icon from "./Icon";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type Finding = { level: string; code: string; message: string };

export function AddressCheck() {
  const [addr, setAddr] = useState("");
  const [res, setRes] = useState<{ findings: Finding[]; twin: string | null } | null>(null);
  const top = res?.findings.find((f) => f.level === "block") ?? res?.findings.find((f) => f.level === "warn") ?? res?.findings[0];
  return (
    <div data-testid="address-check">
      <form className="row-form" onSubmit={async (e) => { e.preventDefault(); const r = await api("/api/shield/address", "POST", { address: addr }); setRes(r.data); }}>
        <input aria-label="Solana address to check" placeholder="Paste a Solana address" value={addr} onChange={(e) => setAddr(e.target.value)} required />
        <button className="btn btn-ink btn-sm">Check address</button>
      </form>
      {res && top && (
        <div className={`mini ${top.level === "block" ? "warn" : top.level === "ok" ? "ok" : "warn"}`} data-testid="address-result">
          <Icon name={top.level === "ok" ? "check" : "alert"} />
          <div>
            <b>{top.level === "block" ? "Blocked" : top.level === "warn" ? "Check before sending" : "Looks fine"}.</b>{" "}
            {res.findings.map((f) => f.message).join(" ")}
            {res.twin && (
              <div className="addr" style={{ marginTop: 8 }}>
                {[...addr.trim()].map((c, i) => <span key={i} className={c !== res.twin![i] ? "x" : ""}>{c}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function LinkScan({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"" | "fast" | "deep">("");
  const [res, setRes] = useState<any>(null);
  const run = async (deep: boolean) => {
    setBusy(deep ? "deep" : "fast"); setRes(null);
    const r = await api("/api/shield/link", "POST", { url, deep });
    setBusy(""); setRes(r.ok ? r.data : { verdict: "risky", reasons: [r.data.error] }); router.refresh();
  };
  if (!enabled) return <div className="empty">Link scanning is off. Turn it on in Limits.</div>;
  return (
    <div data-testid="link-scan">
      <form className="row-form" onSubmit={(e) => { e.preventDefault(); run(false); }}>
        <input aria-label="Link to scan" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} required />
        <button className="btn btn-ink btn-sm" disabled={!!busy}>{busy === "fast" ? "Checking…" : "Quick check"}</button>
        <button type="button" className="btn btn-teal btn-sm" disabled={!!busy || !url} onClick={() => run(true)}>{busy === "deep" ? "Kane is opening the page…" : "Deep scan with Kane"}</button>
      </form>
      {res && (
        <div style={{ marginTop: 14 }} data-testid="link-result">
          <span className={`verdict ${res.verdict}`}>{res.verdict === "safe" ? "Safe" : res.verdict === "risky" ? "Risky" : "Dangerous"}</span>
          {res.source === "kane" && <span className="kane-badge" style={{ marginLeft: 10 }}>Opened by Kane in a real browser</span>}
          <ul className="reasons">{res.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
          {res.kaneError && <div className="sub" style={{ marginTop: 8 }}>Deep scan unavailable: {res.kaneError} Showing the quick check.</div>}
          {res.testUrl && <a className="sub" href={res.testUrl} target="_blank" rel="noreferrer" style={{ color: "var(--teal-ink)" }}>See Kane’s evidence</a>}
        </div>
      )}
    </div>
  );
}

export function AddContact() {
  const router = useRouter();
  const [f, setF] = useState({ label: "", address: "" });
  const [err, setErr] = useState("");
  return (
    <form className="row-form" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      const r = await api("/api/contacts", "POST", f);
      if (!r.ok) return setErr(r.data.error ?? "Couldn’t save.");
      setF({ label: "", address: "" }); router.refresh();
    }}>
      <input aria-label="Contact name" placeholder="Name" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} style={{ maxWidth: 140 }} required />
      <input aria-label="Contact address" placeholder="Solana address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required />
      <button className="btn btn-ghost btn-sm">Save contact</button>
      {err && <div className="err" role="alert" style={{ width: "100%" }}>{err}</div>}
    </form>
  );
}

export function RemoveContact({ id }: { id: number }) {
  const router = useRouter();
  return <button className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/contacts?id=${id}`, "DELETE"); router.refresh(); }}>Remove</button>;
}
