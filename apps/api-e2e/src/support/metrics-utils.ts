import type { AxiosInstance } from 'axios';

export function readCounter(
  metricsText: string,
  name: string,
  labels?: Record<string, string>,
): number {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const labelPart = labels
    ? '\\{' +
      Object.entries(labels)
        .map(([k, v]) => `${esc(k)}="${esc(v)}"`)
        .join(',') +
      '\\}'
    : '';

  const re = new RegExp(`^${esc(name)}${labelPart}\\s+(\\d+(?:\\.\\d+)?)$`, 'm');
  const m = metricsText.match(re);
  return m ? Number(m[1]) : 0;
}

export async function getMetricsText(
  client: AxiosInstance,
  headers: Record<string, string>,
): Promise<string> {
  const r = await client.get('/api/metrics', { headers });
  return String(r.data ?? '');
}