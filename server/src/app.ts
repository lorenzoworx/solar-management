import express from 'express';
import { resolve } from 'node:path';
import type { HealthResponse } from '@solar-management/shared';
import type { Pool } from 'pg';
import { demoSitesRouter } from './features/sites/sites.js';
import helmet from 'helmet';
import { authRouter } from './features/auth/auth.js';
import { ownedSitesRouter } from './features/sites/owned-sites.js';
import { errorHandler } from './http.js';
import { securityOptions } from './config.js';
import type { SecurityOptions } from './features/auth/sessions.js';
import { monitoringRouter } from './features/monitoring/monitoring.js';

// Creating the app does not open a port, so tests can exercise it independently.
export function createApp(clientDirectory?: string, pool?: Pool, security: SecurityOptions = securityOptions()) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', security.trustProxy);
  app.use(helmet(security.production ? {} : {
    strictTransportSecurity: false,
    contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
  }));
  app.use('/api', (_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({
      status: 'ok',
      service: 'solar-management-api',
      timestamp: new Date().toISOString(),
    } satisfies HealthResponse);
  });

  if (pool) {
    app.get('/api/ready', async (_request, response) => {
      try {
        await pool.query('SELECT s.owner_id, r.solar_power_kw, a.resolved_at, ss.expires_at FROM sites s, readings r, alerts a, sessions ss LIMIT 0');
        response.json({ status: 'ready' });
      } catch {
        response.status(503).json({ error: { message: 'Database is not ready.' } });
      }
    });
    app.use('/api/demo/sites', monitoringRouter(pool, security, true));
    app.use('/api/sites', monitoringRouter(pool, security));
    app.use('/api/demo/sites', demoSitesRouter(pool));
    app.use('/api/auth', authRouter(pool, security));
    app.use('/api/sites', ownedSitesRouter(pool, security));
  }

  // An unknown API endpoint must not accidentally return the frontend's HTML.
  app.use('/api', (_request, response) => {
    response.status(404).json({ error: { message: 'API route not found' } });
  });

  if (clientDirectory) {
    app.use(express.static(clientDirectory));
    app.get('/{*path}', (_request, response) => {
      response.sendFile(resolve(clientDirectory, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
