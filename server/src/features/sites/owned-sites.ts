import { Router } from 'express';
import type { Pool } from 'pg';
import { siteInputSchema, siteIdSchema, type Site } from '@solar-management/shared';
import { HttpError } from '../../http.js';
import { csrfProtection, loadSession, requireUser, type SecurityOptions } from '../auth/sessions.js';

const columns = 'id, name, location, capacity_kw::double precision AS "capacityKw"';
export function ownedSitesRouter(pool: Pool, options: SecurityOptions) {
  const router = Router();
  router.use(loadSession(pool, options), requireUser, csrfProtection(options));
  router.get('/', async (request, response) => {
    const result = await pool.query<Site>(`SELECT ${columns} FROM sites WHERE owner_id = $1 AND NOT is_demo ORDER BY name, id`, [request.authSession!.user!.id]);
    response.json({ sites: result.rows });
  });
  router.post('/', async (request, response) => {
    const input = siteInputSchema.parse(request.body);
    const result = await pool.query<Site>(`INSERT INTO sites (name, location, capacity_kw, owner_id) VALUES ($1, $2, $3, $4) RETURNING ${columns}`,
      [input.name, input.location, input.capacityKw, request.authSession!.user!.id]);
    response.status(201).json({ site: result.rows[0] });
  });
  router.get('/:id', async (request, response) => {
    const id = siteIdSchema.parse(request.params.id);
    const result = await pool.query<Site>(`SELECT ${columns} FROM sites WHERE id = $1 AND owner_id = $2 AND NOT is_demo`, [id, request.authSession!.user!.id]);
    if (!result.rows[0]) throw new HttpError(404, 'Installation not found.');
    response.json({ site: result.rows[0] });
  });
  router.put('/:id', async (request, response) => {
    const id = siteIdSchema.parse(request.params.id);
    const input = siteInputSchema.parse(request.body);
    const result = await pool.query<Site>(`UPDATE sites SET name = $1, location = $2, capacity_kw = $3
      WHERE id = $4 AND owner_id = $5 AND NOT is_demo RETURNING ${columns}`,
    [input.name, input.location, input.capacityKw, id, request.authSession!.user!.id]);
    if (!result.rows[0]) throw new HttpError(404, 'Installation not found.');
    response.json({ site: result.rows[0] });
  });
  router.delete('/:id', async (request, response) => {
    const id = siteIdSchema.parse(request.params.id);
    const result = await pool.query('DELETE FROM sites WHERE id = $1 AND owner_id = $2 AND NOT is_demo RETURNING id', [id, request.authSession!.user!.id]);
    if (!result.rowCount) throw new HttpError(404, 'Installation not found.');
    response.status(204).end();
  });
  return router;
}
