import { sessionSchema } from '@solar-management/shared';
import type { z } from 'zod';
import { apiUrl } from './url';

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function apiRequest<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init, credentials: 'same-origin', cache: 'no-store',
      signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
    });
  } catch { throw new Error('Could not reach the service. Please try again.'); }
  const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof body === 'object' && body !== null && 'error' in body &&
      typeof body.error === 'object' && body.error !== null && 'message' in body.error && typeof body.error.message === 'string'
      ? body.error.message : `Request failed (HTTP ${response.status}).`;
    throw new ApiError(response.status, message);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error('The service returned an unexpected response.');
  return parsed.data;
}

export const getSession = () => apiRequest('/auth/session', sessionSchema);
export async function mutate<T>(path: string, method: string, schema: z.ZodType<T>, body?: unknown) {
  // Refresh the token before writes so rotated sessions in another tab work too.
  const session = await getSession();
  return apiRequest(path, schema, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
