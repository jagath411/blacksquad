/**
 * Real Road Routing Service using OSRM (Open Source Routing Machine)
 * Fetches real turn-by-turn road trajectories, distance, duration, and maneuvers.
 */

export interface RouteStep {
  instruction: string;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoadRouteResult {
  coordinates: [number, number][]; // Array of [longitude, latitude]
  distanceKm: number;
  durationMins: number;
  summary: string;
  steps: RouteStep[];
}

interface CacheEntry {
  key: string;
  result: RoadRouteResult;
  timestamp: number;
}

const routeCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

function makeCacheKey(
  origin: [number, number],
  destination: [number, number]
): string {
  // Round to ~10 meters (4 decimals) for cache hit efficiency
  const oLng = origin[0].toFixed(4);
  const oLat = origin[1].toFixed(4);
  const dLng = destination[0].toFixed(4);
  const dLat = destination[1].toFixed(4);
  return `${oLng},${oLat};${dLng},${dLat}`;
}

function parseManeuverInstruction(step: any): string {
  const name = step.name || 'Street';
  const type = step.maneuver?.type;
  const modifier = step.maneuver?.modifier;

  if (type === 'depart') return `Head ${modifier || 'forward'} on ${name}`;
  if (type === 'arrive') return `Arrive at destination on ${name}`;
  if (type === 'turn') return `Turn ${modifier || 'onto'} ${name}`;
  if (type === 'roundabout') return `Take exit ${step.maneuver?.exit || 1} on roundabout onto ${name}`;
  if (type === 'merge') return `Merge onto ${name}`;
  if (type === 'fork') return `Keep ${modifier || 'straight'} for ${name}`;
  if (type === 'on ramp') return `Take ramp onto ${name}`;
  if (type === 'off ramp') return `Take exit towards ${name}`;
  if (type === 'new name') return `Continue onto ${name}`;
  return `Follow ${name}`;
}

/**
 * Fetch a driving road route between two points [lng, lat]
 */
export async function getRoadRoute(
  origin: [number, number],
  destination: [number, number]
): Promise<RoadRouteResult> {
  const [oLng, oLat] = origin;
  const [dLng, dLat] = destination;

  // Validate coordinates
  if (isNaN(oLng) || isNaN(oLat) || isNaN(dLng) || isNaN(dLat)) {
    return createDirectFallback(origin, destination);
  }

  // If points are virtually identical
  if (Math.abs(oLng - dLng) < 0.0001 && Math.abs(oLat - dLat) < 0.0001) {
    return {
      coordinates: [origin, destination],
      distanceKm: 0.1,
      durationMins: 1,
      summary: 'Immediate vicinity',
      steps: [{ instruction: 'You have arrived', name: '', distanceMeters: 10, durationSeconds: 5 }],
    };
  }

  const cacheKey = makeCacheKey(origin, destination);
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BlackSquad-RideApp/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return createDirectFallback(origin, destination);
    }

    const data = await res.json();
    if (data.code === 'Ok' && Array.isArray(data.routes) && data.routes.length > 0) {
      const primaryRoute = data.routes[0];
      const coords: [number, number][] = primaryRoute.geometry?.coordinates || [];
      const distMeters: number = primaryRoute.distance || 0;
      const durationSec: number = primaryRoute.duration || 0;

      const steps: RouteStep[] = [];
      const legs = primaryRoute.legs || [];
      if (legs.length > 0 && Array.isArray(legs[0].steps)) {
        for (const step of legs[0].steps) {
          steps.push({
            instruction: parseManeuverInstruction(step),
            name: step.name || '',
            distanceMeters: Math.round(step.distance || 0),
            durationSeconds: Math.round(step.duration || 0),
          });
        }
      }

      // Generate road summary description (e.g. "via MG Road & Outer Ring Rd")
      const namedRoads = steps
        .map((s) => s.name)
        .filter((n) => n && n.length > 2 && !n.includes('Road 1'));
      const uniqueRoads = Array.from(new Set(namedRoads)).slice(0, 2);
      const summary = uniqueRoads.length > 0 ? `via ${uniqueRoads.join(' & ')}` : 'via fastest road';

      const result: RoadRouteResult = {
        coordinates: coords.length > 1 ? coords : [origin, destination],
        distanceKm: parseFloat((distMeters / 1000).toFixed(1)),
        durationMins: Math.max(1, Math.round(durationSec / 60)),
        summary,
        steps,
      };

      // Save to cache
      routeCache.set(cacheKey, { key: cacheKey, result, timestamp: Date.now() });

      return result;
    }

    return createDirectFallback(origin, destination);
  } catch (error) {
    console.warn('OSRM road route fetch fallback triggered:', error);
    return createDirectFallback(origin, destination);
  }
}

/**
 * Fallback route if external routing is unavailable
 */
function createDirectFallback(
  origin: [number, number],
  destination: [number, number]
): RoadRouteResult {
  const [oLng, oLat] = origin;
  const [dLng, dLat] = destination;

  // Approximate Haversine distance
  const dLatRad = ((dLat - oLat) * Math.PI) / 180;
  const dLngRad = ((dLng - oLng) * Math.PI) / 180;
  const a =
    Math.sin(dLatRad / 2) * Math.sin(dLatRad / 2) +
    Math.cos((oLat * Math.PI) / 180) *
      Math.cos((dLat * Math.PI) / 180) *
      Math.sin(dLngRad / 2) *
      Math.sin(dLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightDistKm = 6371 * c;
  const roadEstimatedKm = parseFloat((straightDistKm * 1.3).toFixed(1));
  const estimatedMins = Math.max(2, Math.round(roadEstimatedKm * 2.5));

  // Generate intermediate interpolated points to give smooth line
  const count = 5;
  const interpolated: [number, number][] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    interpolated.push([oLng + (dLng - oLng) * t, oLat + (dLat - oLat) * t]);
  }

  return {
    coordinates: interpolated,
    distanceKm: roadEstimatedKm,
    durationMins: estimatedMins,
    summary: 'Direct GPS corridor',
    steps: [
      {
        instruction: 'Proceed towards destination',
        name: 'Direct Route',
        distanceMeters: Math.round(roadEstimatedKm * 1000),
        durationSeconds: estimatedMins * 60,
      },
    ],
  };
}
