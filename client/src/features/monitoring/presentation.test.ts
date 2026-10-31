import { describe, expect, it } from 'vitest';
import { missingIntervals, sunPosition } from './presentation';
const date = (minutes: number) => new Date(Date.UTC(2026, 0, 1, 6, minutes)).toISOString();
describe('missing data presentation', () => {
  it('hatches excluded internal gaps and both unobserved edges', () => {
    expect(missingIntervals([{ recordedAt: date(15) }, { recordedAt: date(45) }, { recordedAt: date(90) }], date(0), date(120))).toEqual([
      { from: Date.parse(date(0)), to: Date.parse(date(15)) },
      { from: Date.parse(date(45)), to: Date.parse(date(90)) },
      { from: Date.parse(date(90)), to: Date.parse(date(120)) },
    ]);
  });
  it('does not mark the allowed 30-minute interval as missing', () => {
    expect(missingIntervals([{ recordedAt: date(0) }, { recordedAt: date(30) }], date(0), date(30))).toEqual([]);
    expect(missingIntervals([], date(0), date(30))).toHaveLength(1);
  });
  it('uses UTC and keeps nighttime samples off the daytime interior', () => {
    expect(sunPosition('2026-01-01T12:00:00Z')).toMatchObject({ x: 425, y: 30, daytime: true });
    expect(sunPosition('2026-01-01T03:00:00Z')).toMatchObject({ x: 45, daytime: false });
  });
});
