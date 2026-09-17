import { Router } from 'express';
import type { Pool } from 'pg';
import type { DemoSite, DemoSitesResponse } from '@solar-management/shared';

export function demoSitesRouter(pool: Pool) {
  const router = Router();
  router.get('/', async (_request, response) => {
    try {
      const result = await pool.query<DemoSite>(`
        SELECT id, name, location, capacity_kw::double precision AS "capacityKw"
        FROM sites
        WHERE is_demo = $1
        ORDER BY name, id
      `, [true]);
      response.set('Cache-Control', 'no-store').json({ sites: result.rows } satisfies DemoSitesResponse);
    } catch {
      console.error('Could not load demo installations from PostgreSQL.');
      response.status(503).json({ error: { message: 'Installations are temporarily unavailable. Please try again.' } });
    }
  });
  return router;
}
