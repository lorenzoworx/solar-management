import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { singleSiteSchema, sitesSchema, type Site } from '@solar-management/shared';
import { z } from 'zod';
import { apiRequest, ApiError, mutate } from '../../api/request';
import { useSession } from '../auth/Auth';

function SiteForm({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const cache = useQueryClient();
  const [name, setName] = useState(site?.name ?? '');
  const [location, setLocation] = useState(site?.location ?? '');
  const [capacity, setCapacity] = useState(String(site?.capacityKw ?? ''));
  const save = useMutation({
    mutationFn: () => mutate(site ? `/sites/${site.id}` : '/sites', site ? 'PUT' : 'POST', singleSiteSchema, { name, location, capacityKw: Number(capacity) }),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['sites'] }); onClose(); },
    onError: (error) => { if (error instanceof ApiError && error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] }); },
  });
  function submit(event: FormEvent) { event.preventDefault(); save.mutate(); }
  return (
    <section className="form-panel site-form" aria-labelledby="site-form-title">
      <h2 id="site-form-title">{site ? 'Edit installation' : 'New installation'}</h2>
      <form onSubmit={submit}>
        <label>Installation name<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
        <label>Location<input required maxLength={200} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or address" /></label>
        <label>Installed capacity (kW)<input type="number" required min="0.001" max="1000000" step="0.001" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></label>
        {save.isError && <p role="alert" className="error-message">{save.error.message}</p>}
        <div className="form-actions"><button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save installation'}</button><button type="button" className="button-secondary" onClick={onClose} disabled={save.isPending}>Cancel</button></div>
      </form>
    </section>
  );
}

export function MySites() {
  const session = useSession();
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Site | 'new' | null>(null);
  const sites = useQuery({
    queryKey: ['sites', session.data?.user?.id], enabled: Boolean(session.data?.user), retry: false,
    queryFn: ({ signal }) => apiRequest('/sites', sitesSchema, { signal }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => mutate(`/sites/${id}`, 'DELETE', z.undefined()),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['sites'] }),
    onError: (error) => { if (error instanceof ApiError && error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] }); },
  });
  useEffect(() => {
    if (sites.error instanceof ApiError && sites.error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] });
  }, [sites.error, cache]);
  if (session.isPending) return <p>Loading your account…</p>;
  if (session.isError) return <div><p role="alert">{session.error.message}</p><button onClick={() => void session.refetch()}>Retry account</button></div>;
  if (!session.data.user) return <Navigate to="/login" replace />;
  if (sites.error instanceof ApiError && sites.error.status === 401) return <p>Your session has expired. Updating your account…</p>;
  return (
    <section aria-labelledby="my-sites-title">
      <p className="eyebrow">{session.data.user.name}’s workspace</p>
      <div className="collection-heading"><h1 id="my-sites-title">My installations</h1><button onClick={() => setEditing('new')}>Add installation</button></div>
      <p className="intro">Manage the locations and rated capacity of your solar systems.</p>
      {editing !== null && <SiteForm key={editing === 'new' ? 'new' : editing.id} site={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {sites.isPending && <p>Loading installations…</p>}
      {sites.isError && <div><p role="alert">{sites.error.message}</p><button onClick={() => void sites.refetch()}>Retry installations</button></div>}
      {sites.data?.sites.length === 0 && <p className="empty-state">No installations yet. Add your first solar site to get started.</p>}
      {remove.isError && <p role="alert">{remove.error.message}</p>}
      <ul className="site-grid">
        {sites.data?.sites.map((site) => <li className="installation-card" key={site.id}>
          <p className="eyebrow">Your installation</p><h2>{site.name}</h2><p className="location">{site.location}</p>
          <p className="capacity"><strong>{site.capacityKw.toLocaleString()}</strong> kW</p><p className="capacity-label">Installed capacity</p>
          <div className="site-actions">
            <button className="button-secondary" onClick={() => setEditing(site)}>Edit</button>
            <button className="button-danger" disabled={remove.isPending} onClick={() => { if (window.confirm(`Delete ${site.name}? This cannot be undone.`)) remove.mutate(site.id); }}>Delete</button>
          </div>
        </li>)}
      </ul>
    </section>
  );
}
