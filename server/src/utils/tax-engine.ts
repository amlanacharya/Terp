import { Queryable } from './rate-engine';

export type TaxApplicationScope = 'intra_state' | 'inter_state' | 'all';

interface TaxComponentRow {
  id: string | null;
  component_code: string;
  name: string;
  rate: number | string | null;
  is_percentage: boolean;
  flat_amount: number | string | null;
  applies_to: TaxApplicationScope;
  hsn_code: string | null;
  sort_order: number;
}

export interface TaxPreviewItemInput {
  taxable_base: number;
  hsn_code?: string | null;
}

export interface TaxSnapshotLine {
  tax_component_id: string | null;
  component_code: string;
  component_name: string;
  applies_to: TaxApplicationScope;
  hsn_code: string | null;
  taxable_base: number;
  rate: number | null;
  is_percentage: boolean;
  flat_amount: number | null;
  tax_amount: number;
  sort_order: number;
}

export interface LegacyGstSummary {
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
}

export interface CalculatedInvoiceItemTax {
  taxable_base: number;
  hsn_code: string | null;
  lines: TaxSnapshotLine[];
  legacy: LegacyGstSummary;
  total_tax_amount: number;
  total_amount: number;
}

export interface InvoiceTaxCalculation {
  applies_to: Exclude<TaxApplicationScope, 'all'>;
  subtotal: number;
  tax_components: TaxSnapshotLine[];
  items: CalculatedInvoiceItemTax[];
  legacy: LegacyGstSummary;
  total_tax_amount: number;
  total_amount: number;
}

function toNumber(value: number | string | null | undefined): number {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveInvoiceTaxScope(companyGstin: string | null | undefined, customerGstin: string | null | undefined): Exclude<TaxApplicationScope, 'all'> {
  if (!companyGstin || !customerGstin) {
    return 'intra_state';
  }

  return companyGstin.slice(0, 2) === customerGstin.slice(0, 2) ? 'intra_state' : 'inter_state';
}

async function loadConfiguredComponents(
  db: Queryable,
  appliesTo: Exclude<TaxApplicationScope, 'all'>,
  hsnCode?: string | null
): Promise<TaxComponentRow[]> {
  if (hsnCode) {
    const exactResult = await db.query<TaxComponentRow>(
      `
        SELECT
          id,
          component_code,
          name,
          rate::text,
          is_percentage,
          flat_amount::text,
          applies_to,
          hsn_code,
          sort_order
        FROM tax_components
        WHERE is_active = true
          AND applies_to = ANY($1::tax_application_scope[])
          AND hsn_code = $2
        ORDER BY sort_order ASC, component_code ASC
      `,
      [[appliesTo, 'all'], hsnCode]
    );

    if (exactResult.rows.length > 0) {
      return exactResult.rows;
    }
  }

  const genericResult = await db.query<TaxComponentRow>(
    `
      SELECT
        id,
        component_code,
        name,
        rate::text,
        is_percentage,
        flat_amount::text,
        applies_to,
        hsn_code,
        sort_order
      FROM tax_components
      WHERE is_active = true
        AND applies_to = ANY($1::tax_application_scope[])
        AND hsn_code IS NULL
      ORDER BY sort_order ASC, component_code ASC
    `,
    [[appliesTo, 'all']]
  );

  return genericResult.rows;
}

async function loadLegacyFallbackComponents(
  db: Queryable,
  appliesTo: Exclude<TaxApplicationScope, 'all'>,
  hsnCode?: string | null
): Promise<TaxComponentRow[]> {
  const values: Array<string> = [];
  let whereClause = 'WHERE is_active = true';

  if (hsnCode) {
    values.push(hsnCode);
    whereClause += ` AND hsn_code = $${values.length}`;
  }

  const result = await db.query<{
    hsn_code: string;
    cgst_rate: string;
    sgst_rate: string;
    igst_rate: string;
  }>(
    `
      SELECT hsn_code, cgst_rate::text, sgst_rate::text, igst_rate::text
      FROM gst_rates
      ${whereClause}
      ORDER BY CASE WHEN hsn_code = '9964' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 1
    `,
    values
  );

  const row = result.rows[0] ?? {
    hsn_code: hsnCode ?? '9964',
    cgst_rate: '2.5',
    sgst_rate: '2.5',
    igst_rate: '5',
  };

  if (appliesTo === 'inter_state') {
    return [
      {
        id: null,
        component_code: 'IGST',
        name: 'IGST',
        rate: row.igst_rate,
        is_percentage: true,
        flat_amount: null,
        applies_to: 'inter_state',
        hsn_code: row.hsn_code,
        sort_order: 10,
      },
    ];
  }

  return [
    {
      id: null,
      component_code: 'CGST',
      name: 'CGST',
      rate: row.cgst_rate,
      is_percentage: true,
      flat_amount: null,
      applies_to: 'intra_state',
      hsn_code: row.hsn_code,
      sort_order: 10,
    },
    {
      id: null,
      component_code: 'SGST',
      name: 'SGST',
      rate: row.sgst_rate,
      is_percentage: true,
      flat_amount: null,
      applies_to: 'intra_state',
      hsn_code: row.hsn_code,
      sort_order: 20,
    },
  ];
}

export async function resolveTaxComponentSet(
  db: Queryable,
  input: { appliesTo: Exclude<TaxApplicationScope, 'all'>; hsnCode?: string | null }
): Promise<TaxComponentRow[]> {
  const configuredRows = await loadConfiguredComponents(db, input.appliesTo, input.hsnCode ?? null);
  if (configuredRows.length > 0) {
    return configuredRows;
  }

  return loadLegacyFallbackComponents(db, input.appliesTo, input.hsnCode ?? null);
}

export function summarizeLegacyGstFields(lines: TaxSnapshotLine[]): LegacyGstSummary {
  const summary: LegacyGstSummary = {
    cgst_rate: 0,
    sgst_rate: 0,
    igst_rate: 0,
    cgst_amount: 0,
    sgst_amount: 0,
    igst_amount: 0,
  };

  for (const line of lines) {
    if (line.component_code === 'CGST') {
      summary.cgst_rate = line.rate ?? summary.cgst_rate;
      summary.cgst_amount = roundCurrency(summary.cgst_amount + line.tax_amount);
    }
    if (line.component_code === 'SGST') {
      summary.sgst_rate = line.rate ?? summary.sgst_rate;
      summary.sgst_amount = roundCurrency(summary.sgst_amount + line.tax_amount);
    }
    if (line.component_code === 'IGST') {
      summary.igst_rate = line.rate ?? summary.igst_rate;
      summary.igst_amount = roundCurrency(summary.igst_amount + line.tax_amount);
    }
  }

  return summary;
}

export async function calculateTaxForItem(
  db: Queryable,
  input: TaxPreviewItemInput & {
    appliesTo: Exclude<TaxApplicationScope, 'all'>;
  }
): Promise<CalculatedInvoiceItemTax> {
  const taxableBase = roundCurrency(toNumber(input.taxable_base));
  const components = await resolveTaxComponentSet(db, {
    appliesTo: input.appliesTo,
    hsnCode: input.hsn_code ?? null,
  });

  const lines = components.map<TaxSnapshotLine>((component) => {
    const rate = component.rate == null ? null : toNumber(component.rate);
    const flatAmount = component.flat_amount == null ? null : roundCurrency(toNumber(component.flat_amount));
    const taxAmount = component.is_percentage
      ? roundCurrency((taxableBase * toNumber(component.rate)) / 100)
      : roundCurrency(toNumber(component.flat_amount));

    return {
      tax_component_id: component.id,
      component_code: component.component_code,
      component_name: component.name,
      applies_to: component.applies_to,
      hsn_code: component.hsn_code ?? input.hsn_code ?? null,
      taxable_base: taxableBase,
      rate,
      is_percentage: component.is_percentage,
      flat_amount: flatAmount,
      tax_amount: taxAmount,
      sort_order: component.sort_order,
    };
  });

  const totalTaxAmount = roundCurrency(lines.reduce((sum, line) => sum + line.tax_amount, 0));

  return {
    taxable_base: taxableBase,
    hsn_code: lines.find((line) => line.hsn_code)?.hsn_code ?? input.hsn_code ?? null,
    lines,
    legacy: summarizeLegacyGstFields(lines),
    total_tax_amount: totalTaxAmount,
    total_amount: roundCurrency(taxableBase + totalTaxAmount),
  };
}

export async function calculateInvoiceTaxes(
  db: Queryable,
  input: {
    items: TaxPreviewItemInput[];
    companyGstin?: string | null;
    customerGstin?: string | null;
  }
): Promise<InvoiceTaxCalculation> {
  const appliesTo = resolveInvoiceTaxScope(input.companyGstin, input.customerGstin);
  const itemResults: CalculatedInvoiceItemTax[] = [];

  for (const item of input.items) {
    itemResults.push(
      await calculateTaxForItem(db, {
        taxable_base: item.taxable_base,
        hsn_code: item.hsn_code ?? null,
        appliesTo,
      })
    );
  }

  const aggregateMap = new Map<string, TaxSnapshotLine>();
  for (const item of itemResults) {
    for (const line of item.lines) {
      const key = [
        line.component_code,
        line.component_name,
        line.applies_to,
        line.hsn_code ?? '',
        line.rate == null ? '' : String(line.rate),
        line.flat_amount == null ? '' : String(line.flat_amount),
        String(line.sort_order),
      ].join('|');

      const existing = aggregateMap.get(key);
      if (existing) {
        existing.taxable_base = roundCurrency(existing.taxable_base + line.taxable_base);
        existing.tax_amount = roundCurrency(existing.tax_amount + line.tax_amount);
      } else {
        aggregateMap.set(key, { ...line });
      }
    }
  }

  const taxComponents = Array.from(aggregateMap.values()).sort((left, right) => {
    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order;
    }
    return left.component_code.localeCompare(right.component_code);
  });

  const subtotal = roundCurrency(itemResults.reduce((sum, item) => sum + item.taxable_base, 0));
  const totalTaxAmount = roundCurrency(taxComponents.reduce((sum, line) => sum + line.tax_amount, 0));

  return {
    applies_to: appliesTo,
    subtotal,
    tax_components: taxComponents,
    items: itemResults,
    legacy: summarizeLegacyGstFields(taxComponents),
    total_tax_amount: totalTaxAmount,
    total_amount: roundCurrency(subtotal + totalTaxAmount),
  };
}

export async function persistInvoiceTaxSnapshots(
  db: Queryable,
  input: {
    invoiceId: string;
    items: Array<{ invoiceItemId: string; tax: CalculatedInvoiceItemTax }>;
    taxComponents: TaxSnapshotLine[];
  }
): Promise<void> {
  for (const item of input.items) {
    for (const line of item.tax.lines) {
      await db.query(
        `
          INSERT INTO invoice_item_tax_components (
            invoice_item_id, invoice_id, tax_component_id, component_code, component_name,
            applies_to, hsn_code, taxable_base, rate, is_percentage, flat_amount, tax_amount, sort_order
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10, $11, $12, $13
          )
        `,
        [
          item.invoiceItemId,
          input.invoiceId,
          line.tax_component_id,
          line.component_code,
          line.component_name,
          line.applies_to,
          line.hsn_code,
          line.taxable_base,
          line.rate,
          line.is_percentage,
          line.flat_amount,
          line.tax_amount,
          line.sort_order,
        ]
      );
    }
  }

  for (const line of input.taxComponents) {
    await db.query(
      `
        INSERT INTO invoice_tax_components (
          invoice_id, tax_component_id, component_code, component_name, applies_to,
          hsn_code, taxable_base, rate, is_percentage, flat_amount, tax_amount, sort_order
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12
        )
      `,
      [
        input.invoiceId,
        line.tax_component_id,
        line.component_code,
        line.component_name,
        line.applies_to,
        line.hsn_code,
        line.taxable_base,
        line.rate,
        line.is_percentage,
        line.flat_amount,
        line.tax_amount,
        line.sort_order,
      ]
    );
  }
}
