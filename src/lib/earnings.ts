/**
 * Calculate how much a child earns for a single chore based on the number of
 * days it was completed in the week.
 *
 * Tiers:
 *   < 4 days  → $0
 *   4 days    → 80% of base value
 *   5–6 days  → 100% of base value
 *   7 days    → 100% + $1 bonus
 */
export function getChoreEarnedAmount(
  daysCompleted: number,
  baseValue: number,
): number {
  const n = Math.min(7, Math.max(0, daysCompleted));
  if (n < 4) return 0;
  if (n === 4) return Math.round(baseValue * 0.8 * 100) / 100;
  if (n <= 6) return Math.round(baseValue * 100) / 100;
  return Math.round((baseValue + 1) * 100) / 100;
}
