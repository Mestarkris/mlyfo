import { currentUser } from "@/lib/auth";
import { splitsFor } from "@/lib/queries";
import { fmt } from "@/lib/money";
import { NewSplit, CopyLink } from "@/components/SplitTools";

export default async function Splits() {
  const u = (await currentUser())!;
  const splits = splitsFor(u.id);
  return (
    <>
      <div className="main-top"><h1>Splits</h1></div>
      <div className="grid">
        <div className="c"><h3>New split</h3><NewSplit /></div>
        <div className="c span2">
          <h3>Your splits</h3>
          {splits.length === 0 && <div className="empty">No splits yet. Create one and share each person’s link in your chat.</div>}
          {splits.map((s) => {
            const paid = s.shares.filter((x) => x.paid_at).length;
            const collected = s.shares.filter((x) => x.paid_at).reduce((a, x) => a + x.amount_cents, 0);
            return (
              <div key={s.id} style={{ marginTop: 18 }} data-testid="split">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
                  <h2>{s.title}</h2><span className={`chip ${paid === s.shares.length ? "" : "grey"}`}>{paid} of {s.shares.length} paid</span>
                </div>
                <div className="sub">{fmt(collected)} of {fmt(s.total_cents)} collected</div>
                <div className="receipt" style={{ marginTop: 10 }}>
                  {s.shares.map((sh) => (
                    <div className="receipt-row" key={sh.id} style={{ gridTemplateColumns: "1fr auto auto auto" }}>
                      <span>{sh.is_owner ? "You" : sh.label}</span>
                      <span className="amt">{fmt(sh.amount_cents)}</span>
                      <span className={`state ${sh.paid_at ? "ok" : ""}`}>{sh.is_owner ? "Covered" : sh.paid_at ? `Paid${sh.payer ? " by @" + sh.payer : ""}` : "Waiting"}</span>
                      {!sh.is_owner && !sh.paid_at ? <CopyLink token={sh.token} /> : <span />}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
