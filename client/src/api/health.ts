import { isHealthResponse, type HealthResponse } from '@solar-management/shared';

export async function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/health', {
    signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('The monitoring service returned HTTP ' + response.status + '. Please try again.');
  }

  const data: unknown = await response.json();
  if (!isHealthResponse(data)) {
    throw new Error('The monitoring service returned an unexpected response. Please try again.');
  }
  return data;
}
