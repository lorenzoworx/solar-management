import express from 'express';
import { resolve } from 'node:path';
import type { HealthResponse } from '@solar-management/shared';
import type { Pool } from 'pg';
import { demoSitesRouter } from './features/sites/sites.js';

// Creating the app does not open a port, so tests can exercise it independently.
export function createApp(clientDirectory?: string, pool?: Pool) {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_request, response) => {
    response.set('Cache-Control', 'no-store').json({
      status: 'ok',
      service: 'solar-management-api',
      timestamp: new Date().toISOString(),
    } satisfies HealthResponse);
  });

  if (pool) app.use('/api/demo/sites', demoSitesRouter(pool));

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

  return app;
}
