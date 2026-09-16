import { describe, expect, it } from 'vitest';
import { isHealthResponse } from '../src/index.js';

describe('health response contract', () => {
  it('accepts a response with the expected fields', () => {
    expect(isHealthResponse({
      status: 'ok',
      service: 'solar-management-api',
      timestamp: '2026-09-16T12:00:00.000Z',
    })).toBe(true);
  });

  it.each([
    null,
    'ok',
    {},
    { status: 'error', service: 'api', timestamp: '2026-09-16T12:00:00.000Z' },
    { status: 'ok', service: '', timestamp: '2026-09-16T12:00:00.000Z' },
    { status: 'ok', service: 'api', timestamp: 'not-a-date' },
  ])('rejects malformed response %j', (response) => {
    expect(isHealthResponse(response)).toBe(false);
  });
});
