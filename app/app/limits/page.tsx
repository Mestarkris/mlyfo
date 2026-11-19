import { currentUser } from "@/lib/auth";
import { spentToday, fmt } from "@/lib/money";
import { LimitsForm, ShieldToggles } from "@/components/LimitsForm";

export default async function Limits() {
  const u = (await currentUser())!;
  const today = spentToday(u.id);
  return (
    <>
      <div className="main-top"><h1>Limits</h1></div>
      <p className="sub" style={{ marginTop: 8, maxWidth: "60ch" }}>Payments under your limits go through with one tap. Anything over them waits until you confirm with your password. On the phone, that’s your fingerprint.</p>
      <div className="grid">
        <div className="c span2"><h3>Spend limits</h3><LimitsForm daily={u.daily_limit_cents} perPayment={u.per_payment_cents} newRecipient={u.new_recipient_cents} /></div>
        <div className="c"><h3>Today</h3><div className="big-num">{fmt(today)}</div><div className="sub">sent of your {fmt(u.daily_limit_cents)} daily limit</div>
          <h3 style={{ marginTop: 24 }}>Shield</h3><ShieldToggles lookalike={!!u.shield_lookalike} scamlist={!!u.shield_scamlist} links={!!u.shield_links} />
        </div>
      </div>
    </>
  );
}
