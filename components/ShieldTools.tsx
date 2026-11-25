"use client";
import Icon from "./Icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";

type Finding = { level: string; code: string; message: string };

export function AddressCheck({ initial }: { initial?: string } = {}) {
  const [addr, setAddr] = useState(initial ?? "");
  const [res, setRes] = useState<{ findings: Finding[]; twin: string | null; chain?: "solana" | "evm"; address?: string } | null>(null);
  const check = async (a: string) => { const r = await api("/api/shield/address", "POST", { address: a }); setRes(r.data); };
  // An address handed over from the Android keyboard (/k?address=…) is checked straight away.
  useEffect(() => { if (initial) check(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const top = res?.findings.find((f) => f.level === "block") ?? res?.findings.find((f) => f.level === "warn") ?? res?.findings[0];
  return (
    <div data-testid="address-check">
      <form className="row-form" onSubmit={async (e) => { e.preventDefault(); await check(addr); }}>
        <input aria-label="Address to check" placeholder="Paste a Solana, Ethereum or Base address" value={addr} onChange={(e) => setAddr(e.target.value)} required />
        <button className="btn btn-ink btn-sm">Check address</button>
      </form>
      {res && top && (
        <div className={`mini ${top.level === "block" ? "warn" : top.level === "ok" ? "ok" : "warn"}`} data-testid="address-result">
          <Icon name={top.level === "ok" ? "check" : "alert"} />
          <div>
            <b>{top.level === "block" ? "Blocked" : top.level === "warn" ? "Check before sending" : "Looks fine"}.</b>{" "}
            {res.chain && <span className="chain-tag" data-testid="address-chain">{res.chain === "evm" ? "Ethereum · Base" : "Solana"}</span>}{" "}
            {res.findings.map((f) => f.message).join(" ")}
            {res.twin && (
              <div className="addr" style={{ marginTop: 8 }}>
                {[...(res.address ?? addr.trim())].map((c, i) => <span key={i} className={c.toLowerCase() !== res.twin![i]?.toLowerCase() ? "x" : ""}>{c}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A fake airdrop page on this site that exists only so Shield and Kane have a scam to catch. */
const SAMPLE = "https://mlyfo.vercel.app/test-pages/fake-airdrop.html";

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
      <div className="sub" style={{ marginTop: 8 }}>No link handy? <button type="button" className="linkish" onClick={() => setUrl(SAMPLE)}>Use our test scam page</button></div>
      {res && (
        <div style={{ marginTop: 14 }} data-testid="link-result">
          <span className={`verdict ${res.verdict}`}>{res.verdict === "safe" ? "Safe" : res.verdict === "risky" ? "Risky" : "Dangerous"}</span>
          {res.source === "kane" && <span className="kane-badge" style={{ marginLeft: 10 }}>Opened by Kane in a real browser</span>}
          {res.source === "kane-recorded" && <span className="kane-badge" style={{ marginLeft: 10 }}>Recorded by Kane in a real browser, {new Date(res.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>}
          <ul className="reasons">{res.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
          {res.source === "kane-recorded" && <div className="sub" style={{ marginTop: 8 }}>Kane can’t open pages on this server, so this is the scan Kane recorded of the same link.</div>}
          {res.kaneError && <div className="sub" style={{ marginTop: 8 }}>Kane can’t open pages on this server, so this is the quick check. Try a deep scan on <button type="button" className="linkish" onClick={() => setUrl(SAMPLE)}>our test scam page</button> to see a scan Kane recorded.</div>}
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
      <input aria-label="Contact address" placeholder="Solana, Ethereum or Base address" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} required />
      <button className="btn btn-ghost btn-sm">Save contact</button>
      {err && <div className="err" role="alert" style={{ width: "100%" }}>{err}</div>}
    </form>
  );
}

export function RemoveContact({ id }: { id: number }) {
  const router = useRouter();
  return <button className="btn btn-ghost btn-sm" onClick={async () => { await api(`/api/contacts?id=${id}`, "DELETE"); router.refresh(); }}>Remove</button>;
}
