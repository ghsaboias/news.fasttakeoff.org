import { NextResponse } from 'next/server';
import type { Cloudflare } from '../../../../worker-configuration';
import { CacheManager } from '../../../lib/cache-utils';
import { getCacheContext } from '../../../lib/utils';

/**
 * GET /api/geocode
 * Geocodes a city name to latitude/longitude using OpenStreetMap Nominatim (free), with KV caching.
 * @param request - Query param: city (string, required)
 * @returns {Promise<NextResponse<GeocodeLocation | { error: string }>>}
 * @throws 400 if city is missing, 404 if not found, 500 for API or cache errors.
 * @auth None required.
 */

const GEOCODE_CACHE_TTL_SECONDS = 60 * 24 * 60 * 60; // 60 days (longer since it's free)

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

async function geocodeWithNominatim(city: string): Promise<GeocodeLocation | null> {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'FastTakeoffNews/1.0 (news.fasttakeoff.org)',
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            console.error(`Nominatim API error for ${city}: ${response.status} - ${response.statusText}`);
            return null;
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
        return null;
    }
}

export async function GET(request: Request) {
    const { env } = await getCacheContext();
    const cacheManager = new CacheManager(env);

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');

    if (!city) {
        return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
    }

    // Check KV cache first
    try {
        const cachedLocation = await cacheManager.get<GeocodeLocation>('GEOCODE_CACHE' as keyof Cloudflare.Env, city);
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
    const location = await geocodeWithNominatim(city);

    if (location && location.lat !== 0 && location.lng !== 0) {
        // Cache successful result
        await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, city, location, GEOCODE_CACHE_TTL_SECONDS);
        return NextResponse.json(location);
    } else {
        // Cache "not found" result to prevent repeated API calls
        const notFoundPlaceholder: GeocodeLocation = { lat: 0, lng: 0 };
        await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, city, notFoundPlaceholder, GEOCODE_CACHE_TTL_SECONDS);
        return NextResponse.json({ error: `No geocoding results for ${city}` }, { status: 404 });
    }
}
