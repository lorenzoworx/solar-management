import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const cost = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, cost, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt);
  return `scrypt:131072:8:1:${salt}:${hash.toString('hex')}`;
}

// Unknown accounts still perform the expensive calculation to reduce timing differences.
const dummyHash = 'scrypt:131072:8:1:' + '0'.repeat(32) + ':' + '0'.repeat(128);
export async function verifyPassword(password: string, stored = dummyHash) {
  const parts = stored.split(':');
  if (parts.length !== 6 || parts.slice(0, 4).join(':') !== 'scrypt:131072:8:1') return false;
  const salt = parts[4]!;
  const expected = parts[5]!;
  if (!/^[0-9a-f]{32}$/.test(salt) || !/^[0-9a-f]{128}$/.test(expected)) return false;
  return timingSafeEqual(await derive(password, salt), Buffer.from(expected, 'hex'));
}
