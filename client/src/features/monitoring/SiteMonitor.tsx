import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ingestResponseSchema, monitoringSchema, resolveResponseSchema, type Alert, type Reading } from '@solar-management/shared';
import { apiRequest, ApiError, mutate } from '../../api/request';
import { useSession } from '../auth/Auth';

const utc = (date: string) => new Date(date).toLocaleString(undefined, { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC';
const alertText = (alert: Alert) => alert.type === 'high_temperature'
  ? `Inverter temperature reached ${alert.measuredValue} °C` : `AC voltage reached ${alert.measuredValue} V`;

function DateRange({ from, to, apply }: { from: string; to: string; apply: (from: string, to: string) => void }) {
  const [start, setStart] = useState(from.slice(0, 16)), [end, setEnd] = useState(to.slice(0, 16));
  return <form className="date-range" onSubmit={(event) => { event.preventDefault(); apply(new Date(start + 'Z').toISOString(), new Date(end + 'Z').toISOString()); }}>
    <label>From (UTC)<input type="datetime-local" required value={start} onChange={(event) => setStart(event.target.value)} /></label>
    <label>To (UTC)<input type="datetime-local" required value={end} onChange={(event) => setEnd(event.target.value)} /></label>
    <button>Apply dates</button>
  </form>;
}

function ReadingForm({ id, saved }: { id: string; saved: () => void }) {
  const [time, setTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [power, setPower] = useState(''), [voltage, setVoltage] = useState(''), [temperature, setTemperature] = useState('');
  const cache = useQueryClient();
  const reading = useMutation({
    mutationFn: () => mutate(`/sites/${id}/readings`, 'POST', ingestResponseSchema, {
      recordedAt: new Date(time + 'Z').toISOString(), solarPowerKw: Number(power),
      acVoltageV: voltage === '' ? null : Number(voltage), inverterTempC: temperature === '' ? null : Number(temperature),
    }),
    onSuccess: async () => { await cache.invalidateQueries({ queryKey: ['sites'] }); saved(); },
    onError: (error) => { if (error instanceof ApiError && error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] }); },
  });
  function submit(event: FormEvent) { event.preventDefault(); reading.mutate(); }
  return <section className="form-panel site-form" aria-labelledby="reading-title">
    <h2 id="reading-title">Add a simulated reading</h2>
    <p>These values are practice data. Leave optional measurements blank if unknown.</p>
    <form onSubmit={submit}>
      <label>Recorded at (UTC)<input type="datetime-local" required value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label>Solar power (kW)<input type="number" required min="0" max="1000000" step="0.001" value={power} onChange={(e) => setPower(e.target.value)} /></label>
      <label>Inverter AC voltage (V, optional)<input type="number" min="0" max="600" step="0.01" value={voltage} onChange={(e) => setVoltage(e.target.value)} /></label>
      <label>Inverter temperature (°C, optional)<input type="number" min="-50" max="150" step="0.01" value={temperature} onChange={(e) => setTemperature(e.target.value)} /></label>
      {reading.isError && <p role="alert" className="error-message">{reading.error.message}</p>}
      <div className="form-actions"><button disabled={reading.isPending}>{reading.isPending ? 'Saving…' : 'Save reading'}</button><button type="button" className="button-secondary" onClick={saved}>Cancel</button></div>
    </form>
  </section>;
}

function PowerChart({ readings }: { readings: Reading[] }) {
  // Insert a null point across excluded gaps so the chart doesn't imply observed continuity.
  const points: { time: number; power: number | null }[] = [];
  for (const reading of readings) {
    const time = Date.parse(reading.recordedAt), previous = points.at(-1);
    if (previous && time - previous.time > 30 * 60000) points.push({ time: previous.time + 1, power: null });
    points.push({ time, power: reading.solarPowerKw });
  }
  return <div className="power-chart" role="img" aria-label="Solar power history in kilowatts; timestamps in UTC. Missing intervals are not connected.">
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <LineChart data={points} margin={{ top: 10, right: 16, left: 0, bottom: 10 }}>
        <CartesianGrid stroke="#e5e9e1" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(value: number) => new Date(value).toISOString().slice(5, 16).replace('T', ' ')} minTickGap={60} tick={{ fontSize: 11 }} />
        <YAxis unit=" kW" tick={{ fontSize: 11 }} width={66} />
        <Tooltip labelFormatter={(value) => utc(new Date(Number(value)).toISOString())} />
        <Line type="linear" dataKey="power" name="Solar power (kW)" stroke="#21735a" dot={readings.length === 1 ? { r: 4 } : false} connectNulls={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export function SiteMonitor({ demo = false }: { demo?: boolean }) {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const session = useSession(), cache = useQueryClient();
  const [adding, setAdding] = useState(false);
  const monitor = useQuery({
    queryKey: ['sites', demo ? 'demo' : session.data?.user?.id, id, 'monitoring', params.toString()],
    enabled: demo || Boolean(session.data?.user), retry: false,
    refetchInterval: 15000,
    queryFn: ({ signal }) => apiRequest(`${demo ? '/demo' : ''}/sites/${id}/monitoring?${params}`, monitoringSchema, { signal }),
  });
  useEffect(() => {
    if (monitor.error instanceof ApiError && monitor.error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] });
  }, [monitor.error, cache]);
  const resolve = useMutation({
    mutationFn: (alertId: string) => mutate(`/sites/${id}/alerts/${alertId}/resolve`, 'POST', resolveResponseSchema, {}),
    onSuccess: () => cache.invalidateQueries({ queryKey: ['sites'] }),
    onError: (error) => { if (error instanceof ApiError && error.status === 401) void cache.invalidateQueries({ queryKey: ['session'] }); },
  });
  if (!demo && session.isError) return <div><p role="alert">{session.error.message}</p><button onClick={() => void session.refetch()}>Retry account</button></div>;
  if (!demo && session.isSuccess && !session.data.user) return <Navigate to="/login" replace />;
  if (monitor.isPending) return <p>Loading monitoring data…</p>;
  if (monitor.isError) return <div><p role="alert">{monitor.error.message}</p><button onClick={() => void monitor.refetch()}>Retry monitoring</button> <button className="button-secondary" onClick={() => setParams({})}>Reset dates</button><p><Link to={demo ? '/demo' : '/sites'}>Back to installations</Link></p></div>;
  const data = monitor.data;
  return <>
    <Link to={demo ? '/demo' : '/sites'}>← Installations</Link>
    <div className="monitor-title"><div><p className="eyebrow">{demo ? 'Read-only demo' : 'Your installation'} · Simulated data</p><h1>{data.site.name}</h1><p>{data.site.location} · {data.site.capacityKw} kW installed capacity</p></div>
      {!demo && <button onClick={() => setAdding(true)}>Add reading</button>}
    </div>
    {adding && !demo && <ReadingForm id={id!} saved={() => setAdding(false)} />}
    <p className="freshness">{data.latest ? `Latest reading: ${utc(data.latest.recordedAt)}${monitor.dataUpdatedAt - Date.parse(data.latest.recordedAt) > 30 * 60000 ? ' · Historical data (over 30 minutes old)' : ''}` : 'No readings yet. Add a simulated reading or use the local simulator.'}</p>
    <div className="metric-grid">
      <div className="metric-card"><span>Latest solar power</span><strong>{data.latest?.solarPowerKw ?? '—'} <small>kW</small></strong></div>
      <div className="metric-card"><span>Inverter AC voltage</span><strong>{data.latest?.acVoltageV ?? '—'} <small>V</small></strong></div>
      <div className="metric-card"><span>Inverter temperature</span><strong>{data.latest?.inverterTempC ?? '—'} <small>°C</small></strong></div>
    </div>
    <section className="monitor-section" aria-labelledby="history-heading">
      <h2 id="history-heading">Power history</h2>
      <p className="collection-note">All dates are UTC. {data.availableRange ? `Stored data: ${utc(data.availableRange.from)} – ${utc(data.availableRange.to)}.` : 'No stored date range yet.'}</p>
      <DateRange key={data.range.from + data.range.to} from={data.range.from} to={data.range.to} apply={(from, to) => setParams({ from, to })} />
      <div className="energy-summary"><strong>{data.summary.energyKwh.toFixed(3)} kWh estimated</strong><span>{data.summary.coveragePercent.toFixed(1)}% time coverage · {data.summary.incomplete ? 'Incomplete coverage' : 'Complete coverage'}</span></div>
      <p className="collection-note">Estimate for {utc(data.range.from)} – {utc(data.range.to)}. Uses adjacent power readings; gaps over 30 minutes are excluded. No energy is assumed outside observed intervals.</p>
      {data.readings.length > 0 ? <PowerChart readings={data.readings} /> : <p className="empty-state">No readings in this date range.</p>}
      {data.readings.length > 0 && <details><summary>View latest 20 readings in this range</summary><div className="table-scroll"><table><thead><tr><th>Time (UTC)</th><th>Power (kW)</th><th>AC voltage (V)</th><th>Temperature (°C)</th></tr></thead><tbody>
        {data.readings.slice(-20).reverse().map((reading) => <tr key={reading.recordedAt}><td>{utc(reading.recordedAt)}</td><td>{reading.solarPowerKw}</td><td>{reading.acVoltageV ?? '—'}</td><td>{reading.inverterTempC ?? '—'}</td></tr>)}
      </tbody></table></div></details>}
    </section>
    <section className="monitor-section" aria-labelledby="alerts-heading">
      <h2 id="alerts-heading">Alerts</h2>
      <p className="collection-note">Demo rules: temperature ≥ 50 °C or AC voltage outside 207–253 V. Shows up to 50 alerts across all dates, unresolved first.</p>
      {resolve.isError && <p role="alert">{resolve.error.message}</p>}
      {data.alerts.length === 0 ? <p>No alerts recorded.</p> : <ul className="alert-list">{data.alerts.map((alert) => <li key={alert.id}>
        <div><strong>{alertText(alert)}</strong><p>{utc(alert.triggeredAt)} · {alert.resolvedAt ? `Resolved ${utc(alert.resolvedAt)}` : 'Unresolved'}</p></div>
        {!demo && !alert.resolvedAt && <button className="button-secondary" disabled={resolve.isPending} onClick={() => resolve.mutate(alert.id)}>Resolve</button>}
      </li>)}</ul>}
    </section>
  </>;
}
