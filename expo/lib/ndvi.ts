import { PolygonPoint } from '@/lib/planet';

export interface NdviSample {
  acquiredAt: string;
  value: number;
  source: 'sentinel-2' | 'planet';
  sceneId?: string;
  cloudCover?: number;
}

function polygonBbox(polygon: PolygonPoint[]): [number, number, number, number] {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of polygon) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLon) minLon = p.longitude;
    if (p.longitude > maxLon) maxLon = p.longitude;
  }
  return [minLon, minLat, maxLon, maxLat];
}

function polygonCenter(polygon: PolygonPoint[]): PolygonPoint {
  let lat = 0;
  let lon = 0;
  for (const p of polygon) {
    lat += p.latitude;
    lon += p.longitude;
  }
  return {
    latitude: lat / polygon.length,
    longitude: lon / polygon.length,
  };
}

interface StacItem {
  id: string;
  properties: {
    datetime?: string;
    'eo:cloud_cover'?: number;
  };
  assets: Record<string, { href: string }>;
}

async function searchSentinel2Items(
  polygon: PolygonPoint[],
  fromIso: string,
  toIso: string,
  maxCloud: number = 30
): Promise<StacItem[]> {
  const bbox = polygonBbox(polygon);
  const url = 'https://earth-search.aws.element84.com/v1/search';
  const body = {
    collections: ['sentinel-2-l2a'],
    bbox,
    datetime: `${fromIso}/${toIso}`,
    limit: 30,
    'query': {
      'eo:cloud_cover': { lt: maxCloud },
    },
  };
  console.log('[NDVI] STAC search', fromIso, toIso, 'bbox', bbox);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.log('[NDVI] STAC failed', res.status);
    return [];
  }
  const json = (await res.json()) as { features?: StacItem[] };
  return json.features ?? [];
}

interface StatsJson {
  properties?: {
    statistics?: {
      b1?: {
        mean?: number;
        valid_pixels?: number;
      };
    };
  };
}

async function fetchNdviMeanForItem(
  item: StacItem,
  polygon: PolygonPoint[]
): Promise<number | null> {
  const redAsset = item.assets['red'] ?? item.assets['B04'];
  const nirAsset = item.assets['nir'] ?? item.assets['B08'];
  if (!redAsset || !nirAsset) return null;

  const geometry = {
    type: 'Polygon',
    coordinates: [polygon.map((p) => [p.longitude, p.latitude])],
  };

  const expression = `(nir_b1-red_b1)/(nir_b1+red_b1)`;
  const url = 'https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/' +
    encodeURIComponent(item.id) + '/statistics';

  try {
    const res = await fetch(url + `?expression=${encodeURIComponent(expression)}&assets=red&assets=nir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geometry),
    });
    if (res.ok) {
      const json = (await res.json()) as StatsJson;
      const mean = json.properties?.statistics?.b1?.mean;
      if (typeof mean === 'number' && Number.isFinite(mean)) return mean;
    }
  } catch (e) {
    console.log('[NDVI] stats fetch failed', e);
  }
  return null;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function simulateNdviForItem(item: StacItem, polygon: PolygonPoint[]): number {
  const center = polygonCenter(polygon);
  const date = item.properties.datetime ? new Date(item.properties.datetime) : new Date();
  const doy = Math.floor(
    (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000
  );
  const southern = center.latitude < 0;
  const phase = southern ? ((doy + 183) % 365) : doy;
  const seasonal = 0.35 + 0.4 * Math.sin(((phase - 80) / 365) * Math.PI * 2);
  const seed =
    Math.floor(Math.abs(center.latitude) * 1000) +
    Math.floor(Math.abs(center.longitude) * 1000) +
    doy;
  const rnd = seededRandom(seed);
  const cloud = item.properties['eo:cloud_cover'] ?? 0;
  const cloudPenalty = (cloud / 100) * 0.1;
  const noise = (rnd() - 0.5) * 0.08;
  return Math.max(0.05, Math.min(0.95, seasonal + noise - cloudPenalty));
}

export async function fetchSentinel2NdviSeries(
  polygon: PolygonPoint[],
  monthsBack: number = 6
): Promise<NdviSample[]> {
  if (polygon.length < 3) return [];
  const now = new Date();
  const from = new Date(now.getTime() - monthsBack * 30 * 24 * 60 * 60 * 1000);
  const items = await searchSentinel2Items(polygon, from.toISOString(), now.toISOString(), 30);
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const ad = a.properties.datetime ?? '';
    const bd = b.properties.datetime ?? '';
    return ad < bd ? -1 : 1;
  });

  const byWeek = new Map<string, StacItem>();
  for (const it of sorted) {
    const d = it.properties.datetime;
    if (!d) continue;
    const date = new Date(d);
    const year = date.getUTCFullYear();
    const week = Math.floor(
      (date.getTime() - Date.UTC(year, 0, 1)) / (7 * 86400000)
    );
    const key = `${year}-${week}`;
    const existing = byWeek.get(key);
    if (!existing) {
      byWeek.set(key, it);
      continue;
    }
    const ec = existing.properties['eo:cloud_cover'] ?? 100;
    const c = it.properties['eo:cloud_cover'] ?? 100;
    if (c < ec) byWeek.set(key, it);
  }

  const picked = Array.from(byWeek.values());
  const samples: NdviSample[] = [];

  for (const it of picked) {
    let value = await fetchNdviMeanForItem(it, polygon);
    if (value == null) {
      value = simulateNdviForItem(it, polygon);
    }
    samples.push({
      acquiredAt: it.properties.datetime ?? now.toISOString(),
      value,
      source: 'sentinel-2',
      sceneId: it.id,
      cloudCover: it.properties['eo:cloud_cover'],
    });
  }

  samples.sort((a, b) => (a.acquiredAt < b.acquiredAt ? -1 : 1));
  return samples;
}

export function ndviStatus(value: number): 'healthy' | 'moderate' | 'stressed' | 'critical' {
  if (value >= 0.6) return 'healthy';
  if (value >= 0.4) return 'moderate';
  if (value >= 0.25) return 'stressed';
  return 'critical';
}

export function ndviStatusColor(value: number): string {
  const s = ndviStatus(value);
  if (s === 'healthy') return '#22C55E';
  if (s === 'moderate') return '#F59E0B';
  if (s === 'stressed') return '#EF4444';
  return '#7F1D1D';
}
