const pesoFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Format money for display only; keep original values for calculations and API requests. */
export function formatCurrency(value: number | string | null | undefined): string {
  const amount = Number(value);
  return pesoFormatter.format(Number.isFinite(amount) ? amount : 0);
}
