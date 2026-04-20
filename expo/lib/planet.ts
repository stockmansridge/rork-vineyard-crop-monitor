export interface PlanetScene {
  id: string;
  itemType: string;
  acquired: string;
  cloudCover: number;
  publishedAt: string;
  thumbnail: string;
  pixelResolution: number;
  sunAzimuth?: number;
  sunElevation?: number;
}

export interface PolygonPoint {
  latitude: number;
  longitude: number;
}

const PLANET_API_BASE = 'https://api.planet.com';
const PLANET_TILE_BASE = 'https://tiles.planet.com';

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_PLANET_API_KEY;
  if (!key) {
    throw new Error('EXPO_PUBLIC_PLANET_API_KEY is not set');
  }
  return key;
}

function polygonToGeoJson(polygon: PolygonPoint[]): {
  type: 'Polygon';
  coordinates: number[][][];
} {
  if (polygon.length < 3) {
    throw new Error('Polygon needs at least 3 points');
  }
  const ring = polygon.map((p) => [p.longitude, p.latitude] as [number, number]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

function basicAuthHeader(apiKey: string): string {
  const token = `${apiKey}:`;
  try {
    if (typeof btoa === 'function') {
      return `Basic ${btoa(token)}`;
    }
  } catch (e) {
    console.log('[Planet] btoa unavailable', e);
  }
  const bufferMaybe = (globalThis as unknown as { Buffer?: { from: (s: string) => { toString: (enc: string) => string } } }).Buffer;
  if (bufferMaybe) {
    return `Basic ${bufferMaybe.from(token).toString('base64')}`;
  }
  return `Basic ${token}`;
}

export async function searchLatestScene(
  polygon: PolygonPoint[],
  options: { maxCloudCover?: number; itemType?: string } = {}
): Promise<PlanetScene | null> {
  const apiKey = getApiKey();
  const itemType = options.itemType ?? 'PSScene';
  const maxCloudCover = options.maxCloudCover ?? 0.3;

  const geometry = polygonToGeoJson(polygon);

  const now = new Date();
  const past = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60);

  const filter = {
    type: 'AndFilter',
    config: [
      {
        type: 'GeometryFilter',
        field_name: 'geometry',
        config: geometry,
      },
      {
        type: 'DateRangeFilter',
        field_name: 'acquired',
        config: {
          gte: past.toISOString(),
          lte: now.toISOString(),
        },
      },
      {
        type: 'RangeFilter',
        field_name: 'cloud_cover',
        config: { lte: maxCloudCover },
      },
    ],
  };

  const body = {
    item_types: [itemType],
    filter,
  };

  console.log('[Planet] Searching latest scene for polygon with', polygon.length, 'points');

  const res = await fetch(`${PLANET_API_BASE}/data/v1/quick-search?_sort=acquired desc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(apiKey),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Planet] Search failed', res.status, text);
    throw new Error(`Planet search failed (${res.status})`);
  }

  const json = (await res.json()) as {
    features?: Array<{
      id: string;
      properties: {
        acquired: string;
        cloud_cover: number;
        published: string;
        pixel_resolution?: number;
        sun_azimuth?: number;
        sun_elevation?: number;
        item_type: string;
      };
      _links?: { thumbnail?: string };
    }>;
  };

  const features = json.features ?? [];
  if (features.length === 0) {
    console.log('[Planet] No scenes found');
    return null;
  }

  const sorted = [...features].sort((a, b) =>
    a.properties.acquired < b.properties.acquired ? 1 : -1
  );
  const f = sorted[0];

  const thumbnail = f._links?.thumbnail
    ? `${f._links.thumbnail}?api_key=${apiKey}`
    : '';

  return {
    id: f.id,
    itemType: f.properties.item_type,
    acquired: f.properties.acquired,
    cloudCover: f.properties.cloud_cover,
    publishedAt: f.properties.published,
    thumbnail,
    pixelResolution: f.properties.pixel_resolution ?? 3,
    sunAzimuth: f.properties.sun_azimuth,
    sunElevation: f.properties.sun_elevation,
  };
}

export function getSceneTileUrlTemplate(itemType: string, itemId: string): string {
  const apiKey = getApiKey();
  return `${PLANET_TILE_BASE}/data/v1/${itemType}/${itemId}/{z}/{x}/{y}.png?api_key=${apiKey}`;
}

export interface PlanetMosaic {
  id: string;
  name: string;
  firstAcquired: string;
  lastAcquired: string;
}

export async function getLatestGlobalMosaic(): Promise<PlanetMosaic | null> {
  const apiKey = getApiKey();
  const res = await fetch(
    `${PLANET_API_BASE}/basemaps/v1/mosaics?name__contains=global_monthly&_sort=first_acquired desc&_page_size=1`,
    {
      headers: { Authorization: basicAuthHeader(apiKey) },
    }
  );
  if (!res.ok) {
    console.log('[Planet] Mosaic fetch failed', res.status);
    return null;
  }
  const json = (await res.json()) as {
    mosaics?: Array<{
      id: string;
      name: string;
      first_acquired: string;
      last_acquired: string;
    }>;
  };
  const m = json.mosaics?.[0];
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    firstAcquired: m.first_acquired,
    lastAcquired: m.last_acquired,
  };
}

export function getMosaicTileUrlTemplate(mosaicName: string): string {
  const apiKey = getApiKey();
  return `${PLANET_TILE_BASE}/basemaps/v1/planet-tiles/${mosaicName}/gmap/{z}/{x}/{y}.png?api_key=${apiKey}`;
}
