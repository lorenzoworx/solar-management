import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { ConnectionStatus } from './ConnectionStatus';
import { DemoSites } from './features/sites/DemoSites';
import { AccountNav, AuthPage } from './features/auth/Auth';
import { MySites } from './features/sites/MySites';

export function App() {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="page">
          <header className="site-header">
            <Link className="brand" to="/" aria-label="Solar Management home">
              <img src="/sun.svg" width="40" height="40" alt="" />
              <span>Solar Management</span>
            </Link>
            <AccountNav />
          </header>
          <main>
            <Routes>
              <Route path="/" element={<>
                <p className="eyebrow">Solar Management</p>
                <h1>A home for your<br />solar installations.</h1>
                <p className="intro">Organize your solar sites in one place. Explore sample installations or create a workspace of your own.</p>
                <div className="hero-actions"><Link className="button-link" to="/demo">Try demo</Link><Link className="button-link button-secondary" to="/register">Create account</Link></div>
                <ConnectionStatus />
              </>} />
              <Route path="/demo" element={<><p className="eyebrow">Explore Solar Management</p><h1>Demo workspace</h1><p className="intro">Fictional installations. Free to explore, with no account required.</p><DemoSites /><ConnectionStatus /></>} />
              <Route path="/register" element={<AuthPage key="register" register />} />
              <Route path="/login" element={<AuthPage key="login" />} />
              <Route path="/sites" element={<MySites />} />
              <Route path="*" element={<><h1>Page not found</h1><p><Link to="/">Back to home</Link></p></>} />
            </Routes>
          </main>
          <footer className="site-footer"><span>Solar Management</span><span>Development preview · Sample data</span></footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
