export * from './accounts.js';

export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface DemoSite {
  id: string;
  name: string;
  location: string;
  capacityKw: number;
}

export interface DemoSitesResponse {
  sites: DemoSite[];
}

export function isDemoSitesResponse(value: unknown): value is DemoSitesResponse {
  if (typeof value !== 'object' || value === null || !('sites' in value) || !Array.isArray(value.sites)) return false;
  return value.sites.every((site: unknown) => (
    typeof site === 'object' && site !== null &&
    'id' in site && typeof site.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(site.id) &&
    'name' in site && typeof site.name === 'string' && site.name.trim().length > 0 &&
    'location' in site && typeof site.location === 'string' && site.location.trim().length > 0 &&
    'capacityKw' in site && typeof site.capacityKw === 'number' && Number.isFinite(site.capacityKw) && site.capacityKw > 0
  ));
}

// TypeScript checks our code; this guard checks JSON received at runtime.
export function isHealthResponse(value: unknown): value is HealthResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    value.status === 'ok' &&
    'service' in value &&
    typeof value.service === 'string' &&
    value.service.trim().length > 0 &&
    'timestamp' in value &&
    typeof value.timestamp === 'string' &&
    Number.isFinite(Date.parse(value.timestamp))
  );
}
