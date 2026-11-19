import Link from "next/link";
import { notFound } from "next/navigation";
import { q } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import { ConfirmAddress } from "@/components/PeopleTools";

export const dynamic = "force-dynamic";
export default async function AskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const r = await q.get<{ label: string; fulfilled_at: string | null; name: string; handle: string; user_id: number }>(
    "SELECT r.label, r.fulfilled_at, r.user_id, u.name, u.handle FROM address_requests r JOIN users u ON u.id = r.user_id WHERE r.token = ?", token);
  if (!r) notFound();
  const me = await currentUser();
  return (
    <div className="pay-page">
      <div className="pay-card" data-testid="ask-card">
        <Logo />
        <p className="sub" style={{ marginTop: 24 }}>{r.name} (@{r.handle}) wants to pay you</p>
        <h1 style={{ fontSize: 30, marginTop: 4 }}>Share your wallet safely</h1>
        <p className="sub" style={{ marginTop: 8 }}>Confirming here saves your Mlyfo wallet in @{r.handle}’s contacts as “{r.label}”, marked confirmed by you. Nobody has to paste an address into a chat, so it can’t be swapped on the way.</p>
        <div className="mini ok"><Icon name="shield" /><span>Only your wallet address is shared. Mlyfo never shares your balance or messages.</span></div>
        {r.fulfilled_at ? <div className="mini ok" data-testid="ask-done"><Icon name="check" /><span><b>Already confirmed.</b> Nothing more to do.</span></div>
          : !me ? <Link className="btn btn-ink btn-full" style={{ marginTop: 20 }} href={`/signin?next=/ask/${token}`}>Sign in to confirm</Link>
          : me.id === r.user_id ? <p className="sub" style={{ marginTop: 20 }}>This is your own link. Send it to {r.label} so they can confirm their wallet.</p>
          : <ConfirmAddress token={token} asker={r.handle} address={me.address} />}
      </div>
    </div>
  );
}
