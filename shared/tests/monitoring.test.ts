import { describe, expect, it } from 'vitest';
import { alertRules, estimateEnergy, readingInputSchema } from '../src/monitoring.js';

const time = (minute: number) => new Date(Date.UTC(2026, 8, 11, 12, minute)).toISOString();
const sample = (minute: number, power: number) => ({ recordedAt: time(minute), solarPowerKw: power });
describe('estimated energy and coverage', () => {
  it('uses elapsed time and trapezoids, excluding gaps over 30 minutes', () => {
    const summary = estimateEnergy([sample(0, 2), sample(15, 4), sample(75, 4)], time(0), time(75));
    expect(summary).toEqual({ energyKwh: 0.75, coveredMinutes: 15, windowMinutes: 75, coveragePercent: 20, skippedGaps: 1, incomplete: true });
  });
  it('preserves zero readings and accepts an exact 30-minute interval', () => {
    expect(estimateEnergy([sample(0, 0), sample(30, 4)], time(0), time(30))).toMatchObject({ energyKwh: 1, coveragePercent: 100, incomplete: false });
  });
  it('sorts irregular samples without modifying input or extrapolating', () => {
    const input = [sample(25, 4), sample(5, 2), sample(10, 3)];
    const result = estimateEnergy(input, time(0), time(40));
    expect(result.energyKwh).toBeCloseTo(1.083333, 6);
    expect(result.coveredMinutes).toBe(20);
    expect(result.coveragePercent).toBe(50);
    expect(input[0]).toEqual(sample(25, 4));
  });
  it.each([{ samples: [] }, { samples: [sample(5, 3)] }])('cannot estimate energy without an interval', ({ samples }) => {
    expect(estimateEnergy(samples, time(0), time(60))).toMatchObject({ energyKwh: 0, coveragePercent: 0, incomplete: true });
  });
  it('does not use readings outside the selected window', () => {
    expect(estimateEnergy([sample(0, 4), sample(30, 4)], time(5), time(25)).energyKwh).toBe(0);
  });
});

describe('demo alert rules and telemetry contracts', () => {
  const base = { recordedAt: time(0), solarPowerKw: 0, acVoltageV: 230, inverterTempC: 35 };
  it.each([207, 253])('accepts voltage boundary %s', (voltage) => expect(alertRules({ ...base, acVoltageV: voltage })).toEqual([]));
  it.each([0, 206.99, 253.01])('alerts on voltage %s', (voltage) => expect(alertRules({ ...base, acVoltageV: voltage })[0]?.type).toBe('voltage_out_of_range'));
  it('alerts at 50°C, but never invents missing measurements', () => {
    expect(alertRules({ ...base, inverterTempC: 50 })).toEqual([{ type: 'high_temperature', value: 50 }]);
    expect(alertRules({ ...base, inverterTempC: null, acVoltageV: null })).toEqual([]);
  });
  it('normalizes UTC offsets and preserves zeros and nulls', () => {
    expect(readingInputSchema.parse({ ...base, recordedAt: '2026-09-11T07:00:00-05:00', inverterTempC: null })).toEqual({ ...base, inverterTempC: null });
  });
  it.each([{ ...base, solarPowerKw: -1 }, { ...base, acVoltageV: 601 }, { ...base, inverterTempC: 151 }, { ...base, recordedAt: 'yesterday' }, { ...base, solarPowerKw: 0.0001 }])('rejects invalid input', (value) => {
    expect(readingInputSchema.safeParse(value).success).toBe(false);
  });
});
