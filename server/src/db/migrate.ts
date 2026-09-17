import { fileURLToPath } from 'node:url';
import { runner } from 'node-pg-migrate';

export function migrate(connectionString: string) {
  return runner({
    databaseUrl: connectionString,
    dir: fileURLToPath(new URL('../../migrations/', import.meta.url)),
    migrationsTable: 'pgmigrations',
    direction: 'up',
    checkOrder: true,
    singleTransaction: true,
    log: () => {},
  });
}
