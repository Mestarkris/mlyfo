import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { fmt } from "@/lib/money";
import Logo from "@/components/Logo";
import { PayShare } from "@/components/SplitTools";

export const dynamic = "force-dynamic";
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sh = await q.get<{ label: string; amount_cents: number; paid_at: string | null; is_owner: number; title: string; total_cents: number; handle: string; name: string; n: number }>(`SELECT sh.label, sh.amount_cents, sh.paid_at, sh.is_owner, s.title, s.total_cents, o.handle, o.name,
      (SELECT COUNT(*) FROM split_shares x WHERE x.split_id = s.id) AS n
    FROM split_shares sh JOIN splits s ON s.id = sh.split_id JOIN users o ON o.id = s.owner_id WHERE sh.token = ?`, token);
  if (!sh || sh.is_owner) notFound();
  const me = await currentUser();
  return (
    <div className="pay-page">
      <div className="pay-card" data-testid="pay-card">
        <Logo />
        <p className="sub" style={{ marginTop: 24 }}>{sh.name} (@{sh.handle}) is asking for your share of</p>
        <h1 style={{ fontSize: 32, marginTop: 4 }}>{sh.title}</h1>
        <div className="big-num" style={{ fontSize: 48 }}>{fmt(sh.amount_cents)}</div>
        <div className="sub">{fmt(sh.total_cents)} split {sh.n} ways, for {sh.label}</div>
        <div className="mini ok"><span>⛉</span><span>Shield checked: this request comes from @{sh.handle}’s verified Mlyfo account.</span></div>
        {sh.paid_at ? <div className="mini ok" data-testid="share-paid"><span>✓</span><span><b>Already paid.</b> Nothing more to do.</span></div>
          : me ? <PayShare token={token} amount={sh.amount_cents} owner={sh.handle} />
          : <Link className="btn btn-ink btn-full" style={{ marginTop: 20 }} href={`/signin?next=/pay/${token}`}>Sign in to pay</Link>}
      </div>
    </div>
  );
}
