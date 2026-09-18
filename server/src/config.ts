import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import type { SecurityOptions } from './features/auth/sessions.js';

// Resolve from this file, not the shell's working directory. Existing env wins.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('Set DATABASE_URL in .env. See .env.example.');
  return value;
}

export function securityOptions(): SecurityOptions {
  const production = process.env.NODE_ENV === 'production';
  const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5175';
  const parsed = new URL(origin);
  if (parsed.origin !== origin || (production && parsed.protocol !== 'https:')) {
    throw new Error('APP_ORIGIN must be an exact origin; production requires HTTPS.');
  }
  const trustProxy = Number(process.env.TRUST_PROXY ?? '0');
  if (!Number.isInteger(trustProxy) || trustProxy < 0 || trustProxy > 2) throw new Error('TRUST_PROXY must be 0, 1, or 2 trusted proxy hops.');
  return { production, origin, trustProxy };
}
