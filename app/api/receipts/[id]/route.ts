import { receipt } from "@/lib/receipts";
import { explorerUrl, chainEnabled } from "@/lib/chain";
import { json, bad } from "@/lib/http";

/** Polled by the receipt card until the Solana record lands. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await receipt(id);
  if (!r) return bad("No receipt with that ID.", 404);
  return json({ chain: chainEnabled() ? r.chain_status ?? "pending" : "off", sig: r.chain_sig, explorer: r.chain_sig ? explorerUrl(r.chain_sig) : null });
}
