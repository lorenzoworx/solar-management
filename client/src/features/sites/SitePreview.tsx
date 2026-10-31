import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { monitoringSchema } from '@solar-management/shared';
import { apiRequest } from '../../api/request';
export function SitePreview({ id, capacity }: { id: string; capacity: number }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window) || !element.current) return;
    const observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '100px' });
    observer.observe(element.current); return () => observer.disconnect();
  }, []);
  const preview = useQuery({ queryKey: ['sites', 'demo', id, 'preview'], enabled: visible, staleTime: 60000, retry: false, queryFn: ({ signal }) => apiRequest(`/demo/sites/${id}/monitoring`, monitoringSchema, { signal }) });
  const data = preview.data;
  const values = data?.readings ?? [];
  const end = values.length - 1, start = Math.max(0, end - 47);
  const points = values.slice(start).map((reading, i) => {
    const previous = values[start + i - 1];
    const gap = !previous || Date.parse(reading.recordedAt) - Date.parse(previous.recordedAt) > 30 * 60000;
    return `${i === 0 || gap ? 'M' : 'L'}${i / Math.max(1, end - start) * 130},${40 - Math.min(1, reading.solarPowerKw / capacity) * 34}`;
  }).join(' ');
  return <div ref={element} className="installation-preview">{data?.latest ? <><svg viewBox="0 0 190 48" role="img" aria-label={`Latest simulated power ${data.latest.solarPowerKw} kW; sparkline of the latest available readings`}><path d={points} fill="none" stroke="#1b2b4a" strokeWidth="2"/><circle cx="170" cy="23" r={4 + Math.min(1, data.latest.solarPowerKw / capacity) * 14} fill="#f4b400"/></svg><span>{data.latest.solarPowerKw} kW at {data.latest.recordedAt.slice(11, 16)} UTC</span></> : <span>{preview.isError ? 'Open monitoring for stored readings' : 'Simulated readings / open monitoring to inspect'}</span>}</div>;
}
