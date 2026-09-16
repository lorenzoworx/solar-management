import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

const healthyResponse = {
  status: 'ok',
  service: 'solar-management-api',
  timestamp: '2026-09-16T12:00:00.000Z',
};

describe('connection screen', () => {
  it('shows a pending state and then the verified response', async () => {
    let resolveRequest!: (value: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveRequest = resolve; }));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent('Checking connection');
    expect(screen.getByRole('button')).toBeDisabled();
    resolveRequest(Response.json(healthyResponse));

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check again' })).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.objectContaining({ cache: 'no-store' }));
  });

  it('recovers from a network failure when the user retries', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(Response.json(healthyResponse));
    vi.stubGlobal('fetch', fetchMock);
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Connected')).toBeInTheDocument();
  });

  it('does not report success when the server sends malformed JSON data', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ status: 'ok' })));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected response');
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('reports HTTP failures instead of treating them as successful requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
  });

  it('aborts the active request when the screen unmounts', () => {
    let requestSignal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => {
      requestSignal = options.signal as AbortSignal;
      return new Promise<Response>(() => {});
    }));
    const { unmount } = render(<App />);
    unmount();
    expect(requestSignal?.aborted).toBe(true);
  });
});
