import { databaseUrl } from '../config.js';
import { createPool } from './pool.js';
import { migrate } from './migrate.js';
import { seedDemoSites } from './seed.js';

const command = process.argv[2];
if (command === 'migrate') {
  const applied = await migrate(databaseUrl());
  console.log(`Applied ${applied.length} database migration(s).`);
} else if (command === 'seed') {
  const pool = createPool(databaseUrl());
  try {
    await seedDemoSites(pool);
    console.log('Sample installations saved. Existing sample IDs are reused.');
  } finally {
    await pool.end();
  }
} else {
  throw new Error('Use the db:migrate or db:seed npm script.');
}
