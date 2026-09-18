import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { AuthPage } from './Auth';
import { MySites } from '../sites/MySites';

const user = { id: '20000000-0000-4000-8000-000000000001', name: 'Alice', email: 'alice@example.test' };
const csrfToken = 'a'.repeat(43);

it('keeps registration inputs after a server error and allows correction', async () => {
  let attempts = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/auth/session') return Response.json({ user: null, csrfToken });
    attempts++;
    return attempts === 1
      ? Response.json({ error: { message: 'An account with this email already exists.' } }, { status: 409 })
      : Response.json({ user, csrfToken });
  }));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/register']}><Routes>
    <Route path="/register" element={<AuthPage register />} /><Route path="/sites" element={<h1>My installations</h1>} />
  </Routes></MemoryRouter></QueryClientProvider>);
  const person = userEvent.setup();
  await person.type(screen.getByLabelText('Name', { exact: true }), 'Alice');
  await person.type(screen.getByLabelText('Email'), 'alice@example.test');
  await person.type(screen.getByLabelText('Password'), 'A longer passphrase!');
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  expect(screen.getByLabelText('Name', { exact: true })).toHaveValue('Alice');
  await person.clear(screen.getByLabelText('Email'));
  await person.type(screen.getByLabelText('Email'), 'another@example.test');
  await person.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('heading', { name: 'My installations' })).toBeInTheDocument();
});

it('refreshes expired session state before redirecting to login', async () => {
  let sessionReads = 0;
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/api/auth/session') {
      sessionReads++;
      return Response.json({ user: sessionReads === 1 ? user : null, csrfToken });
    }
    return Response.json({ error: { message: 'Please log in.' } }, { status: 401 });
  }));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={['/sites']}><Routes>
    <Route path="/sites" element={<MySites />} /><Route path="/login" element={<AuthPage />} />
  </Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'My installations' })).not.toBeInTheDocument();
});
