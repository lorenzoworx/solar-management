import type { Reading } from '@solar-management/shared';
export const MAX_COVERED_GAP = 30 * 60000;
export function missingIntervals(readings: Pick<Reading, 'recordedAt'>[], from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  const times = [...new Set(readings.map((r) => Date.parse(r.recordedAt)).filter((t) => Number.isFinite(t) && t >= start && t <= end))].sort((a, b) => a - b);
  if (!times.length) return [{ from: start, to: end }];
  const gaps: { from: number; to: number }[] = [];
  if (times[0]! > start) gaps.push({ from: start, to: times[0]! });
  for (let i = 1; i < times.length; i++) if (times[i]! - times[i - 1]! > MAX_COVERED_GAP) gaps.push({ from: times[i - 1]!, to: times[i]! });
  if (times.at(-1)! < end) gaps.push({ from: times.at(-1)!, to: end });
  return gaps;
}
export function sunPosition(recordedAt: string) {
  const date = new Date(recordedAt);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;
  const fraction = Math.max(0, Math.min(1, (hour - 6) / 12));
  return { x: 45 + fraction * 760, y: 180 - 4 * fraction * (1 - fraction) * 150, daytime: hour >= 6 && hour <= 18 };
}
