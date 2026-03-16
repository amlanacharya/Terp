const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export function formatCurrency(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : dateFormatter.format(parsed);
}
