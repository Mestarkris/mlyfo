import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { spentToday, fmt } from "@/lib/money";
import { activity, pendingConfirmations, splitsFor, blockedCount } from "@/lib/queries";
import { FaucetButton, ConfirmPayment } from "@/components/Widgets";
import { readResults } from "@/lib/verify";

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const u = (await currentUser())!;
  const { welcome } = await searchParams;
  const [today, allSplits, acts, pending, blocked] = await Promise.all([spentToday(u.id), splitsFor(u.id), activity(u.id, 6), pendingConfirmations(u.id), blockedCount(u.id)]);
  const pct = Math.min(100, Math.round((today / u.daily_limit_cents) * 100));
  const splits = allSplits.slice(0, 3);
  const sentAny = acts.some((a) => a.kind === "out" && a.status === "sent");
  const steps = [
    ["Create account", true], [`Claim @${u.handle}`, true],
    ["Set your limits", u.daily_limit_cents !== 20000 || u.per_payment_cents !== 10000 || u.new_recipient_cents !== 2500],
    ["Make a split", splits.length > 0], ["Send a payment", sentAny],
  ] as const;
  const done = steps.filter((s) => s[1]).length;
  const kane = readResults();
  const greet = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="main-top">
        <h1>{welcome ? `Welcome, ${u.name.split(" ")[0]}` : `${greet}, ${u.name.split(" ")[0]}`}</h1>
        <Link className="btn btn-ghost btn-sm" href="/app/pad">Open Mlyfo Pad</Link>
        <Link className="btn btn-ink btn-sm" href="/app/splits">New split</Link>
      </div>

      {done < steps.length && (
        <div className="setup">
          <div className="ring" style={{ background: `conic-gradient(var(--teal) 0 ${(done / steps.length) * 100}%, var(--paper-2) 0)` }}><b>{done}/{steps.length}</b></div>
          <div><b>Finish setting up Mlyfo</b>
            <div className="setup-list">{steps.map(([l, d]) => <span key={l} className={d ? "done" : ""}>{l}</span>)}</div>
          </div>
          <Link className="btn btn-teal btn-sm" href={!steps[2][1] ? "/app/limits" : "/app/pad"}>{!steps[2][1] ? "Set limits" : "Open Mlyfo Pad"}</Link>
        </div>
      )}

      {pending.length > 0 && (
        <div className="c" style={{ marginTop: 18 }}>
          <h3>Waiting for your confirmation</h3>
          {pending.map((p) => <ConfirmPayment key={p.id} id={p.id} amount={p.amount_cents} to={p.other} reason={p.reason} />)}
        </div>
      )}

      <div className="grid">
        <div className="c">
          <h3>Wallet balance <span className="chip grey">Demo USDC</span></h3>
          <div className="big-num" data-testid="balance">{fmt(u.balance_cents)}</div>
          <div className="sub addr" title={u.address}>{u.address.slice(0, 6)}…{u.address.slice(-6)}</div>
          <div style={{ marginTop: 12 }}><FaucetButton /></div>
        </div>
        <div className="c">
          <h3>Spent today</h3>
          <div className="big-num">{fmt(today)}</div>
          <div className="meter"><i style={{ width: pct + "%", background: pct >= 100 ? "var(--amber)" : undefined }} /></div>
          <div className="meter-l"><span>{pct}% used</span><span>{fmt(u.daily_limit_cents)} limit</span></div>
        </div>
        <div className="c">
          <h3>Shield <Link href="/app/shield" style={{ color: "var(--teal-ink)", fontSize: 14 }}>Open</Link></h3>
          <div className="big-num">{blocked}</div>
          <div className="sub">risky payments and links stopped</div>
        </div>

        <div className="c span2">
          <h3>Your splits <Link href="/app/splits" style={{ color: "var(--teal-ink)", fontSize: 14 }}>View all</Link></h3>
          <div className="list">
            {splits.length === 0 && <div className="empty">No splits yet. Type “split 60 / 3” in Mlyfo Pad to make your first one.</div>}
            {splits.map((s) => {
              const paid = s.shares.filter((x) => x.paid_at).length;
              return (
                <div className="li" key={s.id}><div className="ava">⟗</div>
                  <div>{s.title}<small>{fmt(s.total_cents)} split {s.shares.length} ways</small></div>
                  <span className={`chip ${paid === s.shares.length ? "" : "grey"}`}>{paid} of {s.shares.length} paid</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="c">
          <h3>Verified by Kane <Link href="/app/verified" style={{ color: "var(--teal-ink)", fontSize: 14 }}>Details</Link></h3>
          {kane ? (<>
            <div className="big-num">{kane.passed}/{kane.total}</div>
            <div className="sub">money flows passed in a real browser{kane.finishedAt ? `, ${new Date(kane.finishedAt).toLocaleDateString()}` : ""}</div>
          </>) : <div className="empty">No Kane run yet. Run <code>npm run verify</code>.</div>}
        </div>

        <div className="c span2">
          <h3>Recent activity</h3>
          <div className="list">
            {acts.length === 0 && <div className="empty">Nothing yet. Your payments will show up here.</div>}
            {acts.map((a) => (
              <div className="li" key={a.id}><div className="ava">{a.status === "blocked" ? "⚠︎" : a.emoji}</div>
                <div>{a.status === "blocked" ? `Stopped by Shield: ${a.other}` : a.kind === "in" ? `${a.other} paid you` : `To ${a.other}`}
                  <small>{a.status === "needs_confirmation" ? "Waiting for confirmation" : a.note || new Date(a.created_at + "Z").toLocaleString()}</small></div>
                <span className="amt" style={{ color: a.status === "blocked" ? "var(--amber)" : a.kind === "in" ? "var(--teal-ink)" : undefined }}>
                  {a.kind === "in" ? "+" : a.status === "sent" ? "−" : ""}{fmt(a.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="c">
          <h3>Your Mlyfo address</h3>
          <div className="sub" style={{ marginTop: 10 }}>Friends can pay <b>@{u.handle}</b>, or this address:</div>
          <div className="addr" style={{ marginTop: 8 }}>{u.address}</div>
        </div>
      </div>
    </>
  );
}
