export interface HealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
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
