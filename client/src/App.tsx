import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectionStatus } from './ConnectionStatus';
import { DemoSites } from './features/sites/DemoSites';

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <div className="page">
        <header className="site-header">
          <a className="brand" href="/" aria-label="Solar Management home">
            <img src="/sun.svg" width="40" height="40" alt="" />
            <span>Solar Management</span>
          </a>
          <span className="preview-label">Development preview</span>
        </header>
        <main>
          <p className="eyebrow">A foundation for better monitoring</p>
          <h1>Your monitoring<br />workspace.</h1>
          <p className="intro">Explore the first installations in your solar workspace.</p>
          <DemoSites />
          <ConnectionStatus />
          <aside className="next-step" aria-labelledby="next-heading">
            <span className="step-number" aria-hidden="true">04</span>
            <div>
              <h2 id="next-heading">Next: your own installations</h2>
              <p>Add accounts and manage sites that belong to you.</p>
            </div>
          </aside>
        </main>
        <footer className="site-footer">
          <span>Solar Management</span>
          <span>Persistence · Checkpoint 03</span>
        </footer>
      </div>
    </QueryClientProvider>
  );
}
