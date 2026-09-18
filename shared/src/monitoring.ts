import { z } from 'zod';
import { siteSchema } from './accounts.js';

const decimals = (places: number) => (value: number) => Math.abs(value * 10 ** places - Math.round(value * 10 ** places)) < 0.000001;
export const timestampSchema = z.iso.datetime({ offset: true }).transform((value) => new Date(value).toISOString());
export const readingInputSchema = z.object({
  recordedAt: timestampSchema,
  solarPowerKw: z.number().finite().min(0).max(1000000).refine(decimals(3), 'Use at most three decimal places for power.'),
  acVoltageV: z.number().finite().min(0).max(600).refine(decimals(2)).nullable(),
  inverterTempC: z.number().finite().min(-50).max(150).refine(decimals(2)).nullable(),
}).strict();
export const readingSchema = readingInputSchema.extend({ source: z.literal('simulated') });
export const ingestResponseSchema = z.object({ created: z.boolean(), reading: readingSchema });
export const alertTypeSchema = z.enum(['high_temperature', 'voltage_out_of_range']);
export const alertSchema = z.object({
  id: z.uuid(), type: alertTypeSchema, measuredValue: z.number(),
  triggeredAt: timestampSchema, resolvedAt: timestampSchema.nullable(),
});
export const resolveResponseSchema = z.object({ alert: alertSchema });
const rangeSchema = z.object({ from: timestampSchema, to: timestampSchema });
export const rangeQuerySchema = z.object({ from: timestampSchema.optional(), to: timestampSchema.optional() }).strict()
  .refine((value) => Boolean(value.from) === Boolean(value.to), 'Provide both from and to timestamps.');
export const energySummarySchema = z.object({
  energyKwh: z.number(), coveredMinutes: z.number(), windowMinutes: z.number(),
  coveragePercent: z.number(), skippedGaps: z.number(), incomplete: z.boolean(),
});
export const monitoringSchema = z.object({
  site: siteSchema, readings: z.array(readingSchema), latest: readingSchema.nullable(),
  availableRange: rangeSchema.nullable(), range: rangeSchema,
  summary: energySummarySchema, alerts: z.array(alertSchema), source: z.literal('simulated'),
});
export type ReadingInput = z.infer<typeof readingInputSchema>;
export type Reading = z.infer<typeof readingSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type AlertType = z.infer<typeof alertTypeSchema>;
export type Monitoring = z.infer<typeof monitoringSchema>;

export function estimateEnergy(samples: Pick<Reading, 'recordedAt' | 'solarPowerKw'>[], from: string, to: string) {
  const start = Date.parse(from), end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Energy requires an increasing time range.');
  const ordered = samples.map((sample) => ({ time: Date.parse(sample.recordedAt), power: sample.solarPowerKw }))
    .filter((sample) => sample.time >= start && sample.time <= end && Number.isFinite(sample.power) && sample.power >= 0)
    .sort((a, b) => a.time - b.time);
  let energyKwh = 0, coveredMs = 0, skippedGaps = 0;
  for (let index = 1; index < ordered.length; index++) {
    const previous = ordered[index - 1]!, current = ordered[index]!;
    const elapsed = current.time - previous.time;
    if (elapsed <= 0) continue;
    if (elapsed > 30 * 60 * 1000) { skippedGaps++; continue; }
    energyKwh += (previous.power + current.power) / 2 * elapsed / 3600000;
    coveredMs += elapsed;
  }
  return {
    energyKwh: Math.round(energyKwh * 1000000) / 1000000,
    coveredMinutes: coveredMs / 60000, windowMinutes: (end - start) / 60000,
    coveragePercent: coveredMs / (end - start) * 100, skippedGaps,
    incomplete: coveredMs < end - start,
  };
}

export function alertRules(reading: ReadingInput): { type: AlertType; value: number }[] {
  const alerts: { type: AlertType; value: number }[] = [];
  if (reading.inverterTempC !== null && reading.inverterTempC >= 50) alerts.push({ type: 'high_temperature', value: reading.inverterTempC });
  if (reading.acVoltageV !== null && (reading.acVoltageV < 207 || reading.acVoltageV > 253)) alerts.push({ type: 'voltage_out_of_range', value: reading.acVoltageV });
  return alerts;
}
