import type { PoolClient } from 'pg';
import { alertRules, type Reading, type ReadingInput } from '@solar-management/shared';
import { HttpError } from '../../http.js';

export const readingColumns = `recorded_at AS "recordedAt", solar_power_kw::double precision AS "solarPowerKw",
  ac_voltage_v::double precision AS "acVoltageV", inverter_temp_c::double precision AS "inverterTempC", source`;
export type ReadingRow = Omit<Reading, 'recordedAt'> & { recordedAt: Date };
export const toReading = (row: ReadingRow): Reading => ({ ...row, recordedAt: row.recordedAt.toISOString() });

// The caller holds a transaction and has checked/locked the accessible site.
export async function insertReading(client: PoolClient, siteId: string, input: ReadingInput) {
  const inserted = await client.query<ReadingRow>(`
    INSERT INTO readings (site_id, recorded_at, solar_power_kw, ac_voltage_v, inverter_temp_c)
    VALUES ($1, $2, $3, $4, $5) ON CONFLICT (site_id, recorded_at) DO NOTHING RETURNING ${readingColumns}
  `, [siteId, input.recordedAt, input.solarPowerKw, input.acVoltageV, input.inverterTempC]);
  if (!inserted.rowCount) {
    const existing = await client.query<ReadingRow>(`SELECT ${readingColumns} FROM readings WHERE site_id = $1 AND recorded_at = $2`, [siteId, input.recordedAt]);
    const row = toReading(existing.rows[0]!);
    if (row.solarPowerKw !== input.solarPowerKw || row.acVoltageV !== input.acVoltageV || row.inverterTempC !== input.inverterTempC) {
      throw new HttpError(409, 'A different reading already exists at this timestamp.');
    }
    return { created: false, reading: row };
  }
  for (const alert of alertRules(input)) {
    await client.query(`INSERT INTO alerts (site_id, type, measured_value, triggered_at) VALUES ($1, $2, $3, $4)
      ON CONFLICT (site_id, type) WHERE resolved_at IS NULL DO NOTHING`, [siteId, alert.type, alert.value, input.recordedAt]);
  }
  return { created: true, reading: toReading(inserted.rows[0]!) };
}
