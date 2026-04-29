/**
 * Compute the effective merge-window in hours.
 *
 * When `weekendCatchup` is enabled and `now` is a Monday, extends the window
 * by 48 hours so a Monday-morning run picks up PRs merged Saturday and Sunday
 * in addition to the configured base window.
 *
 * Day-of-week is taken from the runner's local clock, which is UTC by default
 * on GitHub Actions runners.
 */
export function computeEffectiveMergeWindow(
  baseHours: number,
  weekendCatchup: boolean,
  now: Date = new Date()
): number {
  if (!weekendCatchup) return baseHours;
  const isMonday = now.getDay() === 1;
  return isMonday ? baseHours + 48 : baseHours;
}
