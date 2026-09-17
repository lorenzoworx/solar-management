import type { Pool } from 'pg';

const samples = [
  ['10000000-0000-4000-8000-000000000001', 'Cedar House', 'Austin, TX', 6.4],
  ['10000000-0000-4000-8000-000000000002', 'Mesa Workshop', 'Phoenix, AZ', 12],
  ['10000000-0000-4000-8000-000000000003', 'Willow Farm', 'Sacramento, CA', 24.5],
] as const;

export async function seedDemoSites(pool: Pool) {
  // All inserts use the same connection so they commit or roll back together.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const sample of samples) {
      await client.query(`
        INSERT INTO sites (id, name, location, capacity_kw, is_demo)
        VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name, location = EXCLUDED.location, capacity_kw = EXCLUDED.capacity_kw
        WHERE sites.is_demo = true
      `, [...sample]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
