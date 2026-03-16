export interface GstCalculationInput {
  subtotal: number;
  isInterState: boolean;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

export interface GstCalculationResult {
  subtotal: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateGst(input: GstCalculationInput): GstCalculationResult {
  const subtotal = Number(input.subtotal || 0);
  const cgstRate = Number(input.cgstRate ?? 2.5);
  const sgstRate = Number(input.sgstRate ?? 2.5);
  const igstRate = Number(input.igstRate ?? 5);

  const cgstAmount = input.isInterState ? 0 : roundCurrency((subtotal * cgstRate) / 100);
  const sgstAmount = input.isInterState ? 0 : roundCurrency((subtotal * sgstRate) / 100);
  const igstAmount = input.isInterState ? roundCurrency((subtotal * igstRate) / 100) : 0;
  const totalAmount = roundCurrency(subtotal + cgstAmount + sgstAmount + igstAmount);

  return {
    subtotal: roundCurrency(subtotal),
    cgst_amount: cgstAmount,
    sgst_amount: sgstAmount,
    igst_amount: igstAmount,
    total_amount: totalAmount,
  };
}
