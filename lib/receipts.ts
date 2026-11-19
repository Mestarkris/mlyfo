import { q } from "./db";

export type ReceiptRow = {
  receipt_id: string; amount_cents: number; note: string; created_at: string; to_address: string;
  chain_status: string | null; chain_sig: string | null;
  from_name: string; from_handle: string; to_handle: string | null; to_name: string | null;
};

/** One receipt by its ID. The ID is the only key, so a receipt can be shared as a link. */
export function receipt(id: string) {
  return q.get<ReceiptRow>(`
    SELECT p.receipt_id, p.amount_cents, p.note, p.created_at, p.to_address, p.chain_status, p.chain_sig,
      f.name AS from_name, f.handle AS from_handle, t.handle AS to_handle, t.name AS to_name
    FROM payments p JOIN users f ON f.id = p.from_user LEFT JOIN users t ON t.address = p.to_address
    WHERE p.receipt_id = ? AND p.status = 'sent'`, id);
}
