import pg from 'pg';

// Called once at application startup; requests share this pool.
export function createPool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 30000,
    statement_timeout: 5000,
  });
  pool.on('error', () => console.error('An idle database connection failed.'));
  return pool;
}
