/** Compact number for tiny chart labels: 940, 1.8k, 12k. */
export function compactNumber(value: number): string {
  const n = Math.round(value);
  const abs = Math.abs(n);
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`;
  if (abs >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toLocaleString();
}
