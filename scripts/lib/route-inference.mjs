import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { locationGazetteer } from './extractors.mjs';

const cacheDir = resolve(import.meta.dirname, '../.cache');
const routeCachePath = resolve(cacheDir, 'route-cache.json');
const geocodeCachePath = resolve(cacheDir, 'geocode-cache.json');

const routeCache = loadCache(routeCachePath);
const geocodeCache = loadCache(geocodeCachePath);
const FETCH_TIMEOUT_MS = 8000;

export async function inferVideoRoutes(videos, transcriptsByBvid) {
  const nextVideos = videos.map((video) => ({
    ...video,
    route: {
      ...video.route,
      polyline: [...video.route.polyline],
    },
  }));

  for (let index = 1; index < nextVideos.length; index += 1) {
    const previous = nextVideos[index - 1];
    const current = nextVideos[index];

    if (!hasCoords(previous.location) || !hasCoords(current.location)) {
      continue;
    }

    const directDistance = roughDistance(
      previous.location.lat,
      previous.location.lng,
      current.location.lat,
      current.location.lng,
    );

    if (sameLocation(previous.location, current.location) || directDistance < 8) {
      current.route = {
        fromLabel: previous.location.label,
        toLabel: current.location.label,
        distanceKm: Number(directDistance.toFixed(1)),
        polyline: [
          [previous.location.lng, previous.location.lat],
          [current.location.lng, current.location.lat],
        ],
        method: 'inferred-sequential',
      };
      console.log(`[route] ${previous.location.label} -> ${current.location.label} keep-local (${current.route.polyline.length} pts)`);
      continue;
    }

    const transcript = transcriptsByBvid.get(current.bvid) ?? '';
    const candidates = await inferIntermediateLocations(
      `${current.title} ${transcript}`,
      previous.location,
      current.location,
    );

    const points = [
      [previous.location.lng, previous.location.lat],
      ...candidates.map((item) => [item.lng, item.lat]),
      [current.location.lng, current.location.lat],
    ];

    const route = await fetchRoutedPolyline(points);
    current.route = {
      fromLabel: previous.location.label,
      toLabel: current.location.label,
      distanceKm: route.distanceKm ?? Number(directDistance.toFixed(1)),
      polyline: route.polyline.length > 1 ? route.polyline : points,
      method: route.polyline.length > 2 || candidates.length > 0 ? 'explicit' : 'inferred-sequential',
    };
    console.log(
      `[route] ${previous.location.label} -> ${current.location.label} via ${
        candidates.map((item) => item.label).join(' / ') || 'direct'
      } (${current.route.polyline.length} pts)`,
    );
  }

  flushCaches();
  return nextVideos;
}

async function inferIntermediateLocations(text, fromLocation, toLocation) {
  const gazetteerMatches = findGazetteerMentions(text)
    .filter((entry) => !sameLocation(entry, fromLocation) && !sameLocation(entry, toLocation));

  const genericQueries = extractGenericPlaceQueries(text)
    .filter((query) => !gazetteerMatches.some((entry) => entry.aliases.includes(query)));

  const geocoded = [];
  for (const query of genericQueries.slice(0, 6)) {
    const place = await geocodePlace(query);
    if (place) geocoded.push(place);
  }

  const uniqueCandidates = dedupeByLabel([...gazetteerMatches, ...geocoded]);
  return uniqueCandidates
    .filter((candidate) => sitsNearJourney(candidate, fromLocation, toLocation))
    .slice(0, 3);
}

function findGazetteerMentions(text) {
  return locationGazetteer
    .map((entry) => {
      let bestIndex = Number.POSITIVE_INFINITY;
      let bestAlias = null;
      for (const alias of entry.aliases) {
        const index = text.indexOf(alias);
        if (index !== -1 && index < bestIndex) {
          bestIndex = index;
          bestAlias = alias;
        }
      }
      if (bestAlias === null) return null;
      return {
        ...entry,
        firstIndex: bestIndex,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.firstIndex - b.firstIndex || b.priority - a.priority);
}

function extractGenericPlaceQueries(text) {
  const matches = [...text.matchAll(/([一-龥]{2,12}(?:镇|乡|县|市))/g)]
    .map((match) => match[1])
    .filter((value) => !/今天|晚上|地方|位置|大城市|房子|废弃房|宾馆|旅馆|市场|菜市场/.test(value));
  return [...new Set(matches)];
}

async function geocodePlace(query) {
  const normalizedQuery = query.includes('湖北') ? query : `${query}, 湖北`;
  if (geocodeCache[normalizedQuery]) {
    return geocodeCache[normalizedQuery];
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'cn');
  url.searchParams.set('q', normalizedQuery);

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) return null;
    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;
    if (!first?.lat || !first?.lon) return null;

    const resolved = {
      label: query,
      aliases: [query],
      province: '湖北省',
      city: null,
      district: null,
      poi: query,
      lat: Number(first.lat),
      lng: Number(first.lon),
      priority: 4,
    };
    geocodeCache[normalizedQuery] = resolved;
    return resolved;
  } catch {
    return null;
  }
}

async function fetchRoutedPolyline(points) {
  if (points.length < 2) {
    return { polyline: points, distanceKm: null };
  }

  const cacheKey = points.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join(';');
  if (routeCache[cacheKey]) {
    return routeCache[cacheKey];
  }

  const coordinates = points.map(([lng, lat]) => `${lng},${lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false&continue_straight=true`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      return { polyline: points, distanceKm: roughPolylineDistance(points) };
    }
    const payload = await response.json();
    const route = payload?.routes?.[0];
    const geometry = route?.geometry?.coordinates;
    if (!Array.isArray(geometry) || geometry.length < 2) {
      return { polyline: points, distanceKm: roughPolylineDistance(points) };
    }
    const result = {
      polyline: geometry.map(([lng, lat]) => [lng, lat]),
      distanceKm: Number(((route.distance ?? 0) / 1000).toFixed(1)),
    };
    routeCache[cacheKey] = result;
    return result;
  } catch {
    return { polyline: points, distanceKm: roughPolylineDistance(points) };
  }
}

function sitsNearJourney(candidate, fromLocation, toLocation) {
  if (!hasCoords(candidate) || !hasCoords(fromLocation) || !hasCoords(toLocation)) {
    return false;
  }

  const direct = roughDistance(fromLocation.lat, fromLocation.lng, toLocation.lat, toLocation.lng);
  const detour =
    roughDistance(fromLocation.lat, fromLocation.lng, candidate.lat, candidate.lng) +
    roughDistance(candidate.lat, candidate.lng, toLocation.lat, toLocation.lng);

  return detour <= Math.max(direct * 1.9, direct + 60);
}

function sameLocation(left, right) {
  if (!left || !right) return false;
  return left.label === right.label || (
    left.lat !== null &&
    left.lng !== null &&
    right.lat !== null &&
    right.lng !== null &&
    Math.abs(left.lat - right.lat) < 0.0001 &&
    Math.abs(left.lng - right.lng) < 0.0001
  );
}

function dedupeByLabel(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item?.label || seen.has(item.label)) continue;
    seen.add(item.label);
    result.push(item);
  }
  return result;
}

function hasCoords(location) {
  return location && location.lat !== null && location.lng !== null;
}

function roughPolylineDistance(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [prevLng, prevLat] = points[index - 1];
    const [lng, lat] = points[index];
    total += roughDistance(prevLat, prevLng, lat, lng);
  }
  return Number(total.toFixed(1));
}

function roughDistance(lat1, lng1, lat2, lng2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function loadCache(path) {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function flushCaches() {
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(routeCachePath, `${JSON.stringify(routeCache, null, 2)}\n`);
  writeFileSync(geocodeCachePath, `${JSON.stringify(geocodeCache, null, 2)}\n`);
}

async function fetchWithTimeout(url) {
  return fetch(url, {
    headers: {
      'User-Agent': 'laohuang-route-infer/1.0',
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}
