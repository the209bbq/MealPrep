/** Display grocery-style dollars (always two decimals, never fractions). */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  const rounded = Math.round(amount * 100) / 100;
  return `$${rounded.toFixed(2)}`;
}

export function formatUsdAboutPerServing(amount: number): string {
  return `About ${formatUsd(amount)} per serving`;
}
