import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DemoSites } from './DemoSites';

const sample = { id: '10000000-0000-4000-8000-000000000001', name: 'Cedar House', location: 'Austin, TX', capacityKw: 6.4 };
function renderSites() {
  return render(<QueryClientProvider client={new QueryClient()}><DemoSites /></QueryClientProvider>);
}

describe('sample installations', () => {
  it('loads saved values and labels their units and sample source', async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
    renderSites();
    expect(screen.getByText('Loading installations…')).toBeInTheDocument();
    respond(Response.json({ sites: [sample] }));
    expect(await screen.findByRole('heading', { name: 'Cedar House' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('6.4 kW');
    expect(screen.getByText('Read-only demo')).toBeInTheDocument();
    expect(screen.queryByText('Loading installations…')).not.toBeInTheDocument();
  });

  it('shows an empty state for an unseeded database', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ sites: [] })));
    renderSites();
    expect(await screen.findByText('No sample installations have been added yet.')).toBeInTheDocument();
  });

  it('lets the user retry a database failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ sites: [sample] })));
    renderSites();
    expect(await screen.findByRole('alert')).toHaveTextContent('HTTP 503');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry installations' }));
    expect(await screen.findByRole('heading', { name: 'Cedar House' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('rejects responses with incorrect units or types', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ sites: [{ ...sample, capacityKw: '6.4' }] })));
    renderSites();
    expect(await screen.findByRole('alert')).toHaveTextContent('unexpected response');
  });
});
