import { useQuery } from '@tanstack/react-query';
import { getDemoSites } from '../../api/sites';
import { Link } from 'react-router-dom';

export function DemoSites() {
  const sites = useQuery({
    queryKey: ['demo', 'sites'],
    queryFn: ({ signal }) => getDemoSites(signal),
    staleTime: 30000,
    retry: false,
  });

  return (
    <section className="installations" aria-labelledby="installations-heading">
      <div className="collection-heading">
        <h2 id="installations-heading">Sample installations</h2>
        <span className="preview-label">Read-only demo</span>
      </div>
      <p className="collection-note">Fictional sites for learning. Capacity is the rated size of the system, in kW.</p>
      {sites.isPending && <p aria-live="polite">Loading installations…</p>}
      {sites.isError && (
        <div className="collection-error">
          <p role="alert">{sites.error.message}</p>
          <button onClick={() => void sites.refetch()} disabled={sites.isFetching}>Retry installations</button>
        </div>
      )}
      {sites.isSuccess && sites.data.length === 0 && <p>No sample installations have been added yet.</p>}
      {sites.data && (
        <ul className="site-grid">
          {sites.data.map((site) => (
            <li key={site.id} className="installation-card">
              <p className="eyebrow">Sample site</p>
              <h3>{site.name}</h3>
              <p className="location">{site.location}</p>
              <p className="capacity"><strong>{site.capacityKw.toLocaleString(undefined, { maximumFractionDigits: 3 })}</strong> kW</p>
              <p className="capacity-label">Installed capacity</p>
              <Link className="button-link site-monitor-link" to={`/demo/sites/${site.id}`}>View monitoring</Link>
            </li>
          ))}
        </ul>
      )}
      <p className="collection-note">Includes seven days of simulated readings with their actual dates, energy estimates, and example alerts.</p>
    </section>
  );
}
