"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { useToast } from "./Toast";

export function LimitsForm({ daily, perPayment, newRecipient }: { daily: number; perPayment: number; newRecipient: number }) {
  const router = useRouter(); const { toast, node } = useToast();
  const [v, setV] = useState({ daily: daily / 100, perPayment: perPayment / 100, newRecipient: newRecipient / 100 });
  const [err, setErr] = useState("");
  const rows: [keyof typeof v, string, string][] = [
    ["daily", "Daily limit", "Total you can send in a day with one tap."],
    ["perPayment", "Per payment", "Any single payment above this needs confirmation."],
    ["newRecipient", "New recipients", "Cap for people you’ve never paid before."],
  ];
  return (
    <form data-testid="limits-form" onSubmit={async (e) => {
      e.preventDefault(); setErr("");
      const r = await api("/api/settings", "PATCH", v);
      if (!r.ok) return setErr(r.data.error ?? "Couldn’t save.");
      toast("Limits saved"); router.refresh();
    }}>
      {rows.map(([k, label, hint]) => (
        <div className="limit-row" key={k}>
          <label htmlFor={k}><b style={{ display: "block" }}>{label}</b><span className="sub">{hint}</span></label>
          <span className="pill-in">$<input id={k} name={k} type="number" min={1} step={1} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) })}
            style={{ width: 90, border: 0, outline: "none", font: "inherit", background: "transparent" }} /></span>
        </div>
      ))}
      {err && <div className="err" role="alert">{err}</div>}
      <button className="btn btn-ink btn-sm" style={{ marginTop: 16 }}>Save limits</button>
      {node}
    </form>
  );
}

export function ShieldToggles({ lookalike, scamlist, links }: { lookalike: boolean; scamlist: boolean; links: boolean }) {
  const router = useRouter(); const { toast, node } = useToast();
  const [s, setS] = useState({ lookalike, scamlist, links });
  const rows: [keyof typeof s, string][] = [["lookalike", "Look-alike addresses"], ["scamlist", "Known scam addresses"], ["links", "Link scanning"]];
  return (<>
    {rows.map(([k, label]) => (
      <div className="limit-row" key={k}><span>{label}</span>
        <button className="toggle" aria-pressed={s[k]} aria-label={label} onClick={async () => {
          const next = { ...s, [k]: !s[k] }; setS(next);
          await api("/api/settings", "PATCH", { [k]: next[k] }); toast(`${label} ${next[k] ? "on" : "off"}`); router.refresh();
        }} />
      </div>
    ))}{node}
  </>);
}
