import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { databaseUrl } from './config.js';
import { createPool } from './db/pool.js';

const configuredPort = process.env.API_PORT ?? '3001';
const port = Number(configuredPort);
if (!/^\d+$/.test(configuredPort) || !Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('API_PORT must be an integer between 1 and 65535.');
}

const host = process.env.API_HOST ?? '127.0.0.1';
const clientDirectory = process.env.NODE_ENV === 'production'
  ? fileURLToPath(new URL('../../client/dist/', import.meta.url))
  : undefined;

if (clientDirectory && !existsSync(clientDirectory + 'index.html')) {
  throw new Error('Frontend build is missing. Run npm run build from the repository root first.');
}

const pool = createPool(databaseUrl());
// Expiry is enforced by every lookup; pruning only reclaims storage.
const pruneSessions = () => { void pool.query('DELETE FROM sessions WHERE expires_at <= now()').catch(() => console.error('Session cleanup failed.')); };
pruneSessions();
const cleanup = setInterval(pruneSessions, 15 * 60 * 1000);
cleanup.unref();
const server = createApp(clientDirectory, pool).listen(port, host, () => {
  console.log('Solar Management API listening on http://' + host + ':' + port);
});

server.on('error', (error) => {
  console.error('Unable to start the API:', error.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    clearInterval(cleanup);
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
