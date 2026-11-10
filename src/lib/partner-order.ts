// The order partners appear in on the Partners tab: whoever you can help right
// now comes first. No native imports, so it stays unit-testable.

export interface PartnerForOrder {
  display_name: string | null;
  this_week_days: number;
  this_week_goal: number;
  resting: boolean | null;
  recently_nudged: boolean;
}

/**
 * 0: behind on their week and not nudged yet (a nudge can help now),
 * 1: behind but already nudged, 2: resting this week, 3: goal already hit.
 */
function group(p: PartnerForOrder): number {
  if (p.resting) return 2;
  if (p.this_week_days >= p.this_week_goal) return 3;
  return p.recently_nudged ? 1 : 0;
}

/** Partners who need a nudge first, the furthest behind first within each group, then by name. */
export function orderPartners<T extends PartnerForOrder>(partners: readonly T[]): T[] {
  const left = (p: PartnerForOrder) => Math.max(p.this_week_goal - p.this_week_days, 0);
  return [...partners].sort(
    (a, b) =>
      group(a) - group(b) ||
      left(b) - left(a) ||
      (a.display_name ?? '').localeCompare(b.display_name ?? ''),
  );
}
