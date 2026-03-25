import { randomUUID } from 'crypto';
import { QueryResultRow } from 'pg';
import { Router } from 'express';
import pool, { query } from '../config/db';
import { generateNextCode } from '../utils/auto-code';
import { authRequired, roleCheck } from '../middleware/auth';
import { getDeleteErrorMessage } from '../utils/db-errors';
import { formatLedgerAmount, writeLedgerEntry } from '../utils/ledger';
import { buildUpdateClause, pickDefinedFields } from '../utils/sql';
import { Queryable } from '../utils/rate-engine';

const router = Router();
const collectionFields = [
  'collection_number',
  'collection_date',
  'invoice_id',
  'amount',
  'payment_mode',
  'reference_number',
  'bank_name',
  'remarks',
] as const;

type SettlementDocumentType = 'invoice' | 'credit_note';

type SettlementLedgerPhase = 'create' | 'amend_reversal' | 'amend_apply' | 'delete';

interface CollectionInvoiceTargetRow extends QueryResultRow {
  id: string;
  customer_id: string;
  invoice_number: string;
  invoice_status: string;
  invoice_type: SettlementDocumentType;
}

interface CollectionLedgerRow extends QueryResultRow {
  id: string;
  collection_number: string;
  invoice_id: string;
  amount: string;
  invoice_number: string;
  customer_id: string;
  invoice_type: SettlementDocumentType;
}

function buildSettlementLedgerEntry(
  invoice: CollectionInvoiceTargetRow,
  collectionId: string,
  collectionNumber: string,
  amount: number,
  phase: SettlementLedgerPhase,
  performedBy: string | null
) {
  if (invoice.invoice_type === 'credit_note') {
    if (phase === 'create') {
      return {
        event_type: 'refund_paid' as const,
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        collection_id: collectionId,
        amount,
        direction: 'AR_INCREASE' as const,
        description: `Refund ${collectionNumber} of Rs.${formatLedgerAmount(amount)} paid against ${invoice.invoice_number}.`,
        performed_by: performedBy,
      };
    }

    if (phase === 'amend_reversal') {
      return {
        event_type: 'refund_amended' as const,
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        collection_id: collectionId,
        amount,
        direction: 'AR_DECREASE' as const,
        description: `Refund ${collectionNumber} amended: previous Rs.${formatLedgerAmount(amount)} allocation reversed from ${invoice.invoice_number}.`,
        performed_by: performedBy,
      };
    }

    if (phase === 'amend_apply') {
      return {
        event_type: 'refund_amended' as const,
        customer_id: invoice.customer_id,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        collection_id: collectionId,
        amount,
        direction: 'AR_INCREASE' as const,
        description: `Refund ${collectionNumber} amended to Rs.${formatLedgerAmount(amount)} against ${invoice.invoice_number}.`,
        performed_by: performedBy,
      };
    }

    return {
      event_type: 'refund_reversed' as const,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      collection_id: collectionId,
      amount,
      direction: 'AR_DECREASE' as const,
      description: `Refund ${collectionNumber} of Rs.${formatLedgerAmount(amount)} reversed (deleted).`,
      performed_by: performedBy,
    };
  }

  if (phase === 'create') {
    return {
      event_type: 'payment_received' as const,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      collection_id: collectionId,
      amount,
      direction: 'AR_DECREASE' as const,
      description: `Payment ${collectionNumber} of Rs.${formatLedgerAmount(amount)} received against ${invoice.invoice_number}.`,
      performed_by: performedBy,
    };
  }

  if (phase === 'amend_reversal') {
    return {
      event_type: 'payment_amended' as const,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      collection_id: collectionId,
      amount,
      direction: 'AR_INCREASE' as const,
      description: `Payment ${collectionNumber} amended: previous Rs.${formatLedgerAmount(amount)} allocation reversed from ${invoice.invoice_number}.`,
      performed_by: performedBy,
    };
  }

  if (phase === 'amend_apply') {
    return {
      event_type: 'payment_amended' as const,
      customer_id: invoice.customer_id,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      collection_id: collectionId,
      amount,
      direction: 'AR_DECREASE' as const,
      description: `Payment ${collectionNumber} amended to Rs.${formatLedgerAmount(amount)} against ${invoice.invoice_number}.`,
      performed_by: performedBy,
    };
  }

  return {
    event_type: 'payment_reversed' as const,
    customer_id: invoice.customer_id,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    collection_id: collectionId,
    amount,
    direction: 'AR_INCREASE' as const,
    description: `Payment ${collectionNumber} of Rs.${formatLedgerAmount(amount)} reversed (deleted).`,
    performed_by: performedBy,
  };
}

async function loadInvoiceTarget(db: Queryable, invoiceId: string): Promise<CollectionInvoiceTargetRow | null> {
  const result = await db.query<CollectionInvoiceTargetRow>(
    `
      SELECT id, customer_id, invoice_number, invoice_status, invoice_type
      FROM invoices
      WHERE id = $1
      LIMIT 1
    `,
    [invoiceId]
  );

  return result.rows[0] ?? null;
}

async function ensureInvoiceSettleable(db: Queryable, invoiceId: string): Promise<CollectionInvoiceTargetRow> {
  const invoice = await loadInvoiceTarget(db, invoiceId);
  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  if (invoice.invoice_status !== 'active') {
    throw new Error('Collections are blocked for non-active invoices.');
  }

  return invoice;
}

async function syncInvoicePaymentStatus(db: Queryable, invoiceId: string): Promise<void> {
  const invoiceResult = await db.query<{ total_amount: number | string }>(
    'SELECT total_amount FROM invoices WHERE id = $1 LIMIT 1',
    [invoiceId]
  );
  const totalAmount = Number(invoiceResult.rows[0]?.total_amount ?? 0);
  const collectedResult = await db.query<{ collected_amount: number | string }>(
    `
      SELECT COALESCE(SUM(amount), 0) AS collected_amount
      FROM collections
      WHERE invoice_id = $1
    `,
    [invoiceId]
  );
  const collectedAmount = Number(collectedResult.rows[0]?.collected_amount ?? 0);
  const paymentStatus = collectedAmount <= 0
    ? 'pending'
    : collectedAmount < totalAmount
      ? 'partial'
      : 'completed';

  await db.query(
    `
      UPDATE invoices
      SET
        payment_status = $1,
        updated_at = now()
      WHERE id = $2 AND invoice_status = 'active'
    `,
    [paymentStatus, invoiceId]
  );
}

async function loadCollectionLedgerRow(db: Queryable, collectionId: string): Promise<CollectionLedgerRow | null> {
  const result = await db.query<CollectionLedgerRow>(
    `
      SELECT
        col.id,
        col.collection_number,
        col.invoice_id,
        col.amount AS amount,
        inv.invoice_number,
        inv.customer_id,
        inv.invoice_type
      FROM collections col
      JOIN invoices inv ON inv.id = col.invoice_id
      WHERE col.id = $1
      LIMIT 1
    `,
    [collectionId]
  );

  return result.rows[0] ?? null;
}

router.get('/', authRequired, async (_req, res) => {
  try {
    const result = await query(
      `
        SELECT
          col.*,
          json_build_object(
            'id', inv.id,
            'invoice_number', inv.invoice_number,
            'total_amount', inv.total_amount,
            'payment_status', inv.payment_status,
            'invoice_type', inv.invoice_type,
            'customer', json_build_object('id', cust.id, 'name', cust.name, 'customer_code', cust.customer_code)
          ) AS invoice
        FROM collections col
        JOIN invoices inv ON inv.id = col.invoice_id
        JOIN customers cust ON cust.id = inv.customer_id
        ORDER BY col.collection_date DESC, col.created_at DESC
      `
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetching collections failed:', error);
    res.status(500).json({ message: 'Unable to fetch collections.' });
  }
});

router.post('/', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const payload = pickDefinedFields(req.body as Record<string, unknown>, collectionFields);
  if (!payload.collection_date || !payload.invoice_id || !payload.amount || !payload.payment_mode) {
    res.status(400).json({ message: 'Missing required collection fields.' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const invoice = await ensureInvoiceSettleable(client, String(payload.invoice_id));
    const amount = Number(payload.amount);
    const collectionId = randomUUID();
    const collectionNumber = await generateNextCode(client, {
      table: 'collections',
      column: 'collection_number',
      prefix: 'GT-RCPT',
      padLength: 4,
    });
    const result = await client.query(
      `
        INSERT INTO collections (
          id, collection_number, collection_date, invoice_id, amount, payment_mode,
          reference_number, bank_name, remarks, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10
        )
        RETURNING *
      `,
      [
        collectionId,
        collectionNumber,
        payload.collection_date,
        payload.invoice_id,
        amount,
        payload.payment_mode,
        payload.reference_number ?? null,
        payload.bank_name ?? null,
        payload.remarks ?? null,
        req.user?.id ?? null,
      ]
    );

    await syncInvoicePaymentStatus(client, String(payload.invoice_id));
    await writeLedgerEntry(
      client,
      buildSettlementLedgerEntry(
        invoice,
        result.rows[0].id,
        collectionNumber,
        amount,
        'create',
        req.user?.id ?? null
      )
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Creating collection failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to create collection.';
    const status = message === 'Invoice not found.' ? 404 : message === 'Collections are blocked for non-active invoices.' ? 409 : 500;
    res.status(status).json({
      message,
    });
  } finally {
    client.release();
  }
});

router.put('/:id', authRequired, roleCheck(['admin', 'manager', 'accountant']), async (req, res) => {
  const collectionId = String(req.params.id);
  const payload = pickDefinedFields(req.body as Record<string, unknown>, collectionFields);
  if (Object.keys(payload).length === 0) {
    res.status(400).json({ message: 'No collection fields supplied for update.' });
    return;
  }

    const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await loadCollectionLedgerRow(client, collectionId);
    if (!existing) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Collection not found.' });
      return;
    }

    const hasInvoiceChange = Object.prototype.hasOwnProperty.call(payload, 'invoice_id')
      && String(payload.invoice_id) !== existing.invoice_id;
    const hasAmountChange = Object.prototype.hasOwnProperty.call(payload, 'amount')
      && Number(payload.amount) !== Number(existing.amount);
    const targetInvoice = hasInvoiceChange
      ? await ensureInvoiceSettleable(client, String(payload.invoice_id))
      : await ensureInvoiceSettleable(client, existing.invoice_id);

    const update = buildUpdateClause(payload);
    const result = await client.query(
      `UPDATE collections SET ${update.clause} WHERE id = $${update.values.length + 1} RETURNING *`,
      [...update.values, collectionId]
    );

    const existingInvoiceTarget: CollectionInvoiceTargetRow = {
      id: existing.invoice_id,
      customer_id: existing.customer_id,
      invoice_number: existing.invoice_number,
      invoice_status: 'active',
      invoice_type: existing.invoice_type,
    };

    const updatedAmount = Object.prototype.hasOwnProperty.call(payload, 'amount')
      ? Number(payload.amount)
      : Number(existing.amount);
    const updatedCollectionNumber = Object.prototype.hasOwnProperty.call(payload, 'collection_number')
      ? String(payload.collection_number)
      : existing.collection_number;

    await syncInvoicePaymentStatus(client, existing.invoice_id);
    if (hasInvoiceChange) {
      await syncInvoicePaymentStatus(client, targetInvoice.id);
    }

    if (hasAmountChange || hasInvoiceChange) {
      await writeLedgerEntry(
        client,
        buildSettlementLedgerEntry(
          existingInvoiceTarget,
          existing.id,
          existing.collection_number,
          Number(existing.amount),
          'amend_reversal',
          req.user?.id ?? null
        )
      );

      await writeLedgerEntry(
        client,
        buildSettlementLedgerEntry(
          targetInvoice,
          existing.id,
          updatedCollectionNumber,
          updatedAmount,
          'amend_apply',
          req.user?.id ?? null
        )
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Updating collection failed:', error);
    const message = error instanceof Error ? error.message : 'Unable to update collection.';
    const status = message === 'Invoice not found.' ? 404 : message === 'Collections are blocked for non-active invoices.' ? 409 : 500;
    res.status(status).json({
      message,
    });
  } finally {
    client.release();
  }
});

router.delete('/:id', authRequired, roleCheck(['admin', 'manager']), async (req, res) => {
  const collectionId = String(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await loadCollectionLedgerRow(client, collectionId);
    if (!existing) {
      await client.query('ROLLBACK');
      res.status(404).json({ message: 'Collection not found.' });
      return;
    }

    await client.query('DELETE FROM collections WHERE id = $1', [req.params.id]);
    await syncInvoicePaymentStatus(client, existing.invoice_id);
    await writeLedgerEntry(
      client,
      buildSettlementLedgerEntry(
        {
          id: existing.invoice_id,
          customer_id: existing.customer_id,
          invoice_number: existing.invoice_number,
          invoice_status: 'active',
          invoice_type: existing.invoice_type,
        },
        existing.id,
        existing.collection_number,
        Number(existing.amount),
        'delete',
        req.user?.id ?? null
      )
    );

    await client.query('COMMIT');
    res.status(204).send();
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Deleting collection failed:', error);
    res.status(500).json({ message: getDeleteErrorMessage('collection', error) });
  } finally {
    client.release();
  }
});

export default router;

