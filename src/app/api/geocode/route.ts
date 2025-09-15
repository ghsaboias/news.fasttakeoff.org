import { TIME } from '@/lib/config';
import { NextResponse } from 'next/server';
import type { Cloudflare } from '../../../../worker-configuration';
import { CacheManager } from '../../../lib/cache-utils';
import { getCacheContext } from '../../../lib/utils';

/**
 * GET /api/geocode
 * Geocodes a city name to latitude/longitude using OpenStreetMap Nominatim (free), with KV caching.
 * Improvements:
 * - Normalized cache keys (trim, collapse spaces, lowercase)
 * - Optional country parameter to disambiguate and strengthen cache keys
 * - Separate TTLs: long for positives, short for negatives
 * - Avoid negative-caching on upstream errors (no-cache on 429/5xx)
 * @param request - Query params: city (string, required), country? (ISO alpha-2 or alpha-3), countryCode? (alias)
 * @returns {Promise<NextResponse<GeocodeLocation | { error: string }>>}
 * @throws 400 if city is missing, 404 if not found, 502 for upstream errors, 500 for internal errors.
 */

const GEOCODE_CACHE_TTL_SECONDS = TIME.daysToSec(60); // 60 days (positive)
const GEOCODE_NEGATIVE_TTL_SECONDS = TIME.daysToSec(7); // 7 days (negative)

function normalizeCityKey(city: string): string {
    return city
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

interface GeocodeLocation {
    lat: number;
    lng: number;
    country?: string;
    country_code?: string;
    display_name?: string;
}

interface NominatimResponse {
    lat: string;
    lon: string;
    display_name: string;
    address?: {
        country?: string;
        country_code?: string;
    };
}

async function geocodeWithNominatim(city: string, countryCode?: string): Promise<GeocodeLocation | null | 'UPSTREAM_ERROR'> {
    try {
        const params = new URLSearchParams({
            q: city,
            format: 'json',
            limit: '1',
            addressdetails: '1',
        });
        if (countryCode) {
            // Nominatim expects lowercase ISO2 or ISO3
            params.set('countrycodes', countryCode.toLowerCase());
        }

        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
            headers: {
                // Include contact per Nominatim policy
                'User-Agent': 'FastTakeoffNews/1.0 (contact: support@fasttakeoff.org)',
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.error(`Nominatim API error for ${city}: ${response.status} - ${response.statusText}`);
            return 'UPSTREAM_ERROR';
        }

        const data: NominatimResponse[] = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            return {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon),
                country: result.address?.country,
                country_code: result.address?.country_code?.toUpperCase(),
                display_name: result.display_name
            };
        }

        return null;
    } catch (error) {
        console.error(`Nominatim geocoding error for ${city}:`, error);
        return 'UPSTREAM_ERROR';
    }
}

export async function GET(request: Request) {
    const { env } = await getCacheContext();
    const cacheManager = new CacheManager(env);

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const countryParam = searchParams.get('country') || searchParams.get('countryCode') || undefined;

    if (!city) {
        return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
    }

    // Check KV cache first
    try {
        const key = countryParam
            ? `${normalizeCityKey(city)}|${countryParam.toUpperCase()}`
            : normalizeCityKey(city);
        const cachedLocation = await cacheManager.get<GeocodeLocation>('GEOCODE_CACHE' as keyof Cloudflare.Env, key);
        if (cachedLocation) {
            // Check if the cached location is the "not found" placeholder
            if (cachedLocation.lat === 0 && cachedLocation.lng === 0) {
                return NextResponse.json({ error: `No geocoding results for ${city} (cached)` }, { status: 404 });
            }
            return NextResponse.json(cachedLocation);
        }
    } catch (cacheError) {
        console.error(`Error reading from GEOCODE_CACHE for city ${city}:`, cacheError);
    }

    // Try Nominatim geocoding
    const location = await geocodeWithNominatim(city, countryParam);

    if (location && location !== 'UPSTREAM_ERROR' && location.lat !== 0 && location.lng !== 0) {
        // Cache successful result
        const key = countryParam
            ? `${normalizeCityKey(city)}|${countryParam.toUpperCase()}`
            : normalizeCityKey(city);
        await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, key, location, GEOCODE_CACHE_TTL_SECONDS);
        return NextResponse.json(location);
    } else if (location === 'UPSTREAM_ERROR') {
        // Do not cache upstream errors; let callers retry later
        return NextResponse.json({ error: 'Geocoding provider error' }, { status: 502 });
    } else {
        // Cache "not found" result to prevent repeated API calls (shorter TTL)
        const notFoundPlaceholder: GeocodeLocation = { lat: 0, lng: 0 };
        const key = countryParam
            ? `${normalizeCityKey(city)}|${countryParam.toUpperCase()}`
            : normalizeCityKey(city);
        await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, key, notFoundPlaceholder, GEOCODE_NEGATIVE_TTL_SECONDS);
        return NextResponse.json({ error: `No geocoding results for ${city}` }, { status: 404 });
    }
}
