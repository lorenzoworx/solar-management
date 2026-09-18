import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { estimateEnergy, rangeQuerySchema, readingInputSchema, siteIdSchema, type Alert, type Monitoring, type Site } from '@solar-management/shared';
import { transaction } from '../../db/transaction.js';
import { HttpError } from '../../http.js';
import { csrfProtection, loadSession, requireUser, type SecurityOptions } from '../auth/sessions.js';
import { insertReading, readingColumns, toReading, type ReadingRow } from './readings.js';

const alertColumns = `id, type, measured_value AS "measuredValue", triggered_at AS "triggeredAt", resolved_at AS "resolvedAt"`;
type AlertRow = Omit<Alert, 'triggeredAt' | 'resolvedAt'> & { triggeredAt: Date; resolvedAt: Date | null };
const toAlert = (row: AlertRow): Alert => ({ ...row, triggeredAt: row.triggeredAt.toISOString(), resolvedAt: row.resolvedAt?.toISOString() ?? null });

async function accessibleSite(client: Pool | PoolClient, id: string, ownerId: string | null, lock = false) {
  const result = await client.query<Site>(`SELECT id, name, location, capacity_kw::double precision AS "capacityKw" FROM sites
    WHERE id = $1 AND (($2::uuid IS NULL AND is_demo) OR (owner_id = $2 AND NOT is_demo)) ${lock ? 'FOR UPDATE' : ''}`, [id, ownerId]);
  if (!result.rows[0]) throw new HttpError(404, 'Installation not found.');
  return result.rows[0];
}

export function monitoringRouter(pool: Pool, options: SecurityOptions, demo = false) {
  const router = Router();
  if (!demo) router.use(['/:id/monitoring', '/:id/readings', '/:id/alerts/:alertId/resolve'], loadSession(pool, options), requireUser, csrfProtection(options));
  router.get('/:id/monitoring', async (request, response) => {
    const id = siteIdSchema.parse(request.params.id);
    const ownerId = demo ? null : request.authSession!.user!.id;
    const query = rangeQuerySchema.parse(request.query);
    const data = await transaction(pool, async (client): Promise<Monitoring> => {
      // One consistent snapshot for the latest reading, selected history, and alerts.
      await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
      const site = await accessibleSite(client, id, ownerId);
      const dates = (await client.query<{ first: Date | null; last: Date | null }>('SELECT min(recorded_at) AS first, max(recorded_at) AS last FROM readings WHERE site_id = $1', [id])).rows[0]!;
      const to = query.to ?? dates.last?.toISOString() ?? new Date().toISOString();
      const from = query.from ?? new Date(Date.parse(to) - 7 * 86400000).toISOString();
      const duration = Date.parse(to) - Date.parse(from);
      if (duration <= 0 || duration > 31 * 86400000) throw new HttpError(400, 'Choose an increasing date range of at most 31 days.');
      const rows = await client.query<ReadingRow>(`SELECT ${readingColumns} FROM readings WHERE site_id = $1 AND recorded_at >= $2 AND recorded_at <= $3 ORDER BY recorded_at LIMIT 10001`, [id, from, to]);
      if (rows.rows.length > 10000) throw new HttpError(422, 'Too many readings. Choose a shorter date range.');
      const latest = await client.query<ReadingRow>(`SELECT ${readingColumns} FROM readings WHERE site_id = $1 ORDER BY recorded_at DESC LIMIT 1`, [id]);
      const alerts = await client.query<AlertRow>(`SELECT ${alertColumns} FROM alerts WHERE site_id = $1 ORDER BY (resolved_at IS NULL) DESC, triggered_at DESC, id LIMIT 50`, [id]);
      const readings = rows.rows.map(toReading);
      return {
        site, readings, latest: latest.rows[0] ? toReading(latest.rows[0]) : null,
        availableRange: dates.first && dates.last ? { from: dates.first.toISOString(), to: dates.last.toISOString() } : null,
        range: { from, to }, summary: estimateEnergy(readings, from, to), alerts: alerts.rows.map(toAlert), source: 'simulated',
      };
    });
    response.json(data);
  });
  if (!demo) {
    router.post('/:id/readings', async (request, response) => {
      const id = siteIdSchema.parse(request.params.id);
      const input = readingInputSchema.parse(request.body);
      if (Date.parse(input.recordedAt) > Date.now() + 300000) throw new HttpError(400, 'Readings cannot be more than five minutes in the future.');
      const result = await transaction(pool, async (client) => {
        await accessibleSite(client, id, request.authSession!.user!.id, true);
        return insertReading(client, id, input);
      });
      response.status(result.created ? 201 : 200).json(result);
    });
    router.post('/:id/alerts/:alertId/resolve', async (request, response) => {
      const id = siteIdSchema.parse(request.params.id), alertId = siteIdSchema.parse(request.params.alertId);
      const alert = await transaction(pool, async (client) => {
        await accessibleSite(client, id, request.authSession!.user!.id, true);
        const result = await client.query<AlertRow>(`UPDATE alerts SET resolved_at = COALESCE(resolved_at, now()) WHERE id = $1 AND site_id = $2 RETURNING ${alertColumns}`, [alertId, id]);
        if (!result.rows[0]) throw new HttpError(404, 'Alert not found.');
        return toAlert(result.rows[0]);
      });
      response.json({ alert });
    });
  }
  return router;
}
