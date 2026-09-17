import { describe, expect, it } from 'vitest';
import { isDemoSitesResponse } from '../src/index.js';

const site = { id: '10000000-0000-4000-8000-000000000001', name: 'Sample', location: 'Austin', capacityKw: 6.4 };
describe('installation response validation', () => {
  it('accepts empty or populated lists', () => {
    expect(isDemoSitesResponse({ sites: [] })).toBe(true);
    expect(isDemoSitesResponse({ sites: [site] })).toBe(true);
  });
  it.each([null, {}, { sites: 'wrong' }, { sites: [null] },
    { sites: [{ ...site, capacityKw: '6.4' }] }, { sites: [{ ...site, capacityKw: 0 }] },
    { sites: [{ ...site, capacityKw: Infinity }] }, { sites: [{ ...site, id: 'invalid' }] },
    { sites: [{ ...site, name: ' ' }] }, { sites: [{ ...site, location: '' }] },
  ])('rejects malformed data: %j', (value) => {
    expect(isDemoSitesResponse(value)).toBe(false);
  });
});
