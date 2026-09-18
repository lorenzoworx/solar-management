import type { Pool } from 'pg';
import { transaction } from './transaction.js';
import { insertReading } from '../features/monitoring/readings.js';

export const DEMO_START = '2026-09-11T00:00:00.000Z';
export const DEMO_END = '2026-09-18T00:00:00.000Z';
export async function seedDemoReadings(pool: Pool) {
  await transaction(pool, async (client) => {
    const sites = await client.query<{ id: string; capacity: number }>('SELECT id, capacity_kw::float8 AS capacity FROM sites WHERE is_demo ORDER BY id FOR UPDATE');
    for (const [index, site] of sites.rows.entries()) {
      for (let point = 0; point <= 7 * 96; point++) {
        // A deliberate missing interval demonstrates incomplete energy coverage.
        if (index === 2 && point >= 340 && point <= 348) continue;
        const time = Date.parse(DEMO_START) + point * 15 * 60000;
        const hour = (new Date(time).getUTCHours() + new Date(time).getUTCMinutes() / 60 + 17) % 24;
        const daylight = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
        const weather = 0.78 + 0.12 * Math.cos(Math.floor(point / 96) + index);
        await insertReading(client, site.id, {
          recordedAt: new Date(time).toISOString(),
          solarPowerKw: Math.round(site.capacity * daylight * weather * 1000) / 1000,
          acVoltageV: point === 600 && index === 1 ? 258 : Math.round((230 + Math.sin(point / 10) * 3) * 100) / 100,
          inverterTempC: point === 601 && index === 0 ? 52 : Math.round((22 + 23 * daylight) * 100) / 100,
        });
      }
    }
  });
}
