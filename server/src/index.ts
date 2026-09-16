import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

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

const server = createApp(clientDirectory).listen(port, host, () => {
  console.log('Solar Management API listening on http://' + host + ':' + port);
});

server.on('error', (error) => {
  console.error('Unable to start the API:', error.message);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
