import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { receipt } from "@/lib/receipts";
import { explorerUrl, chainEnabled } from "@/lib/chain";
import { fmt } from "@/lib/money";
import Logo from "@/components/Logo";
import Icon from "@/components/Icon";
import { Tick } from "@/components/Receipt";
import { ChainStatus } from "@/components/ReceiptTools";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mlyfo receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await receipt(id);
  if (!r) notFound();
  const to = r.to_handle ? `@${r.to_handle}` : `${r.to_address.slice(0, 4)}…${r.to_address.slice(-4)}`;
  const when = new Date(r.created_at + "Z");
  return (
    <div className="pay-page">
      <div className="receipt-page" data-testid="receipt-page">
        <Logo />
        <div className="slip-wrap big">
          <div className="slip perf">
            <div className="rcpt-top"><span>Payment receipt</span><Tick /></div>
            <div className="rcpt-amt num">{fmt(r.amount_cents)}</div>
            <div className="rcpt-sub">Demo USDC, paid</div>
            <dl className="rcpt-rows">
              <div><dt>From</dt><dd>{r.from_name} <span>@{r.from_handle}</span></dd></div>
              <div><dt>To</dt><dd>{r.to_name ?? "Wallet"} <span>{to}</span></dd></div>
              <div><dt>Wallet</dt><dd className="num small">{r.to_address}</dd></div>
              {r.note && <div><dt>For</dt><dd>{r.note}</dd></div>}
              <div><dt>When</dt><dd className="num">{when.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC</dd></div>
              <div><dt>Receipt</dt><dd className="num">{r.receipt_id}</dd></div>
            </dl>
            <div className="rcpt-foot"><Icon name="shield" />Shield checked the address before the money moved</div>
          </div>
        </div>
        <ChainStatus id={r.receipt_id} initial={{ chain: chainEnabled() ? r.chain_status ?? "pending" : "off", explorer: r.chain_sig ? explorerUrl(r.chain_sig) : null, sig: r.chain_sig }} />
      </div>
    </div>
  );
}
