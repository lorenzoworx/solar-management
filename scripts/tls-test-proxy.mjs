// Local CI-only HTTPS proxy. Never used as the public deployment's TLS endpoint.
import { createServer } from 'node:https';
import { request as forward } from 'node:http';
import { readFileSync } from 'node:fs';

const base = process.env.APP_BASE_PATH ?? '/';
const server = createServer({
  cert: readFileSync('.local/ci-cert.pem'), key: readFileSync('.local/ci-key.pem'),
}, (request, response) => {
  if (!request.url?.startsWith(base)) { response.writeHead(404); response.end('Not found'); return; }
  const upstream = forward({
    hostname: '127.0.0.1', port: 3001, path: '/' + request.url.slice(base.length), method: request.method,
    headers: { ...request.headers, 'x-forwarded-proto': 'https', 'x-forwarded-for': '127.0.0.1' },
  }, (result) => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); });
  upstream.on('error', () => { response.writeHead(502); response.end('Application unavailable'); });
  request.pipe(upstream);
});
server.listen(8443, '127.0.0.1', () => console.log('CI HTTPS proxy ready.'));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => process.exit(0)));
