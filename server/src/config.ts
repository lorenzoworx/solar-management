import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

// Resolve from this file, not the shell's working directory. Existing env wins.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);

export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('Set DATABASE_URL in .env. See .env.example.');
  return value;
}
