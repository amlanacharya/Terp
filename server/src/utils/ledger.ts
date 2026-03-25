import { randomUUID } from 'crypto';
import { Queryable } from './rate-engine';

export type FinancialLedgerEventType =
  | 'invoice_issued'
  | 'invoice_deleted'
  | 'payment_received'
  | 'payment_amended'
  | 'payment_reversed'
  | 'refund_paid'
  | 'refund_amended'
  | 'refund_reversed'
  | 'invoice_voided'
  | 'credit_note_issued'
  | 'credit_note_applied' // Reserved for future customer-credit knockoff flow.
  | 'write_off';

export type FinancialLedgerDirection = 'AR_INCREASE' | 'AR_DECREASE';

export interface LedgerEntry {
  event_type: FinancialLedgerEventType;
  customer_id: string | null;
  invoice_id: string;
  invoice_number: string;
  collection_id?: string | null;
  amount: number;
  direction: FinancialLedgerDirection;
  description: string;
  performed_by?: string | null;
}

export function formatLedgerAmount(amount: number): string {
  return amount.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export async function writeLedgerEntry(db: Queryable, entry: LedgerEntry): Promise<void> {
  await db.query(
    `
      INSERT INTO financial_ledger (
        id,
        event_type,
        customer_id,
        invoice_id,
        invoice_number,
        collection_id,
        amount,
        direction,
        description,
        performed_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
    [
      randomUUID(),
      entry.event_type,
      entry.customer_id,
      entry.invoice_id,
      entry.invoice_number,
      entry.collection_id ?? null,
      entry.amount,
      entry.direction,
      entry.description,
      entry.performed_by ?? null,
    ]
  );
}

