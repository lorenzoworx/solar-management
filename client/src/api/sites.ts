import { isDemoSitesResponse } from '@solar-management/shared';

export async function getDemoSites(signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch('/api/demo/sites', {
      signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach the installation service. Please try again.');
  }
  if (!response.ok) throw new Error(`Installations are unavailable (HTTP ${response.status}). Please try again.`);
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error('The installation service returned an unexpected response.'); }
  if (!isDemoSitesResponse(data)) throw new Error('The installation service returned an unexpected response.');
  return data.sites;
}
