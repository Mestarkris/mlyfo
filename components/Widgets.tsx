"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { useToast } from "./Toast";

export const money = (c: number) => (c < 0 ? "−" : "") + "$" + (Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function FaucetButton() {
  const router = useRouter(); const { toast, node } = useToast(); const [busy, setBusy] = useState(false);
  return (<>
    <button className="btn btn-ghost btn-sm" disabled={busy} onClick={async () => {
      setBusy(true); const r = await api("/api/faucet"); setBusy(false);
      toast(r.ok ? "Added $100 in demo USDC" : r.data.error ?? "Couldn’t add funds"); router.refresh();
    }}>Add $100 demo USDC</button>{node}
  </>);
}

/** Password re-entry for payments that went over a spend limit. */
export function ConfirmPayment({ id, amount, to, reason, onDone }: { id: number; amount: number; to: string; reason: string; onDone?: (ok: boolean) => void }) {
  const router = useRouter(); const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <form data-testid="confirm-payment" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      const r = await api("/api/pay/confirm", "POST", { paymentId: id, password: pw });
      setBusy(false);
      if (!r.ok) { setErr(r.data.error ?? r.data.reasons?.[0] ?? "Couldn’t confirm."); return; }
      onDone?.(true); router.refresh();
    }}>
      <div className="mini warn" style={{ marginTop: 10 }}><span>◔</span><span><b>Confirm {money(amount)} to {to}.</b> {reason}</span></div>
      <div className="row-form">
        <input type="password" placeholder="Your password" aria-label="Your password to confirm" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <button className="btn btn-ink btn-sm" disabled={busy}>{busy ? "Confirming…" : "Confirm payment"}</button>
      </div>
      {err && <div className="err" role="alert">{err}</div>}
    </form>
  );
}
