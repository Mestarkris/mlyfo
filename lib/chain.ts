import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import { q } from "./db";

/**
 * Public proof for a receipt. After a payment settles, the server writes a small memo
 * ("mlyfo receipt MLY-… $10.00 …") to Solana devnet and stores the transaction signature.
 * The demo USDC itself moves inside Mlyfo; this record is what anyone can look up on Solana Explorer.
 */
const RPC = process.env.SOLANA_DEVNET_RPC ?? "https://api.devnet.solana.com";
const MEMO = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function chainEnabled() {
  return !!process.env.SOLANA_DEVNET_SECRET;
}

let payer: Keypair | null = null;
function signer() {
  return (payer ??= Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_DEVNET_SECRET!.trim())));
}

export const explorerUrl = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;

/** Record one settled payment. Never throws: a failure only marks the receipt as not recorded. */
export async function recordOnChain(paymentId: number): Promise<void> {
  if (!chainEnabled()) return;
  const p = await q.get<{ receipt_id: string | null; amount_cents: number; created_at: string; chain_status: string | null }>(
    "SELECT receipt_id, amount_cents, created_at, chain_status FROM payments WHERE id = ? AND status = 'sent'", paymentId);
  if (!p?.receipt_id || p.chain_status === "recorded") return;
  await q.run("UPDATE payments SET chain_status = 'pending' WHERE id = ?", paymentId);
  try {
    const memo = `mlyfo receipt ${p.receipt_id} $${(p.amount_cents / 100).toFixed(2)} demo-USDC ${p.created_at}Z`;
    const ix = new TransactionInstruction({ programId: MEMO, keys: [], data: Buffer.from(memo, "utf8") });
    const conn = new Connection(RPC, "confirmed");
    const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [signer()], { commitment: "confirmed", maxRetries: 3 });
    await q.run("UPDATE payments SET chain_status = 'recorded', chain_sig = ? WHERE id = ?", sig, paymentId);
  } catch (e) {
    console.error("Mlyfo chain record failed:", String((e as Error)?.message ?? e).slice(0, 300));
    await q.run("UPDATE payments SET chain_status = 'failed' WHERE id = ?", paymentId);
  }
}
