import { useEffect, useState } from 'react';
import type { HealthResponse } from '@solar-management/shared';
import { getHealth } from './api/health';

type ConnectionState =
  | { status: 'checking' }
  | { status: 'connected'; response: HealthResponse }
  | { status: 'error'; message: string };

export function ConnectionStatus() {
  const [connection, setConnection] = useState<ConnectionState>({ status: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getHealth(controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setConnection({ status: 'connected', response });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error && error.name === 'Error'
          ? error.message
          : 'Could not reach the monitoring service. Check that the API is running and try again.';
        setConnection({ status: 'error', message });
      });
    return () => controller.abort();
  }, [attempt]);

  function checkAgain() {
    setConnection({ status: 'checking' });
    setAttempt((current) => current + 1);
  }

  const statusText = connection.status === 'connected'
    ? 'Connected'
    : connection.status === 'checking' ? 'Checking connection' : 'Connection unavailable';

  return (
    <section className="connection-card" aria-labelledby="connection-heading">
      <div className="card-header">
        <div>
          <p className="eyebrow">System connection</p>
          <h2 id="connection-heading">Monitoring service</h2>
        </div>
        <div className={'status status-' + connection.status} role="status" aria-live="polite">
          <span className="status-dot" aria-hidden="true" />
          {statusText}
        </div>
      </div>

      <div className="connection-body">
        {connection.status === 'checking' && <p>Waiting for the service to respond…</p>}
        {connection.status === 'error' && <p className="error-message" role="alert">{connection.message}</p>}
        {connection.status === 'connected' && (
          <>
            <p>The service is reachable and returned a valid response.</p>
            <p className="response-time">
              Last response: <time dateTime={connection.response.timestamp}>
                {new Date(connection.response.timestamp).toLocaleString(undefined, {
                  dateStyle: 'medium', timeStyle: 'long',
                })}
              </time>
            </p>
            <details>
              <summary>View API response</summary>
              <pre>{JSON.stringify(connection.response, null, 2)}</pre>
            </details>
          </>
        )}
      </div>

      <div className="card-footer">
        <p>This check confirms API connectivity. Installations are loaded separately from the database.</p>
        <button onClick={checkAgain} disabled={connection.status === 'checking'}>
          {connection.status === 'checking' ? 'Checking…' : connection.status === 'error' ? 'Try again' : 'Check again'}
        </button>
      </div>
    </section>

  );
}
