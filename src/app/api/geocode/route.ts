import { NextResponse } from 'next/server';
import type { Cloudflare } from '../../../../worker-configuration';
import { CacheManager } from '../../../lib/cache-utils';
import { getCacheContext } from '../../../lib/utils';

const GOOGLE_GEOCODING_API_KEY = process.env.GOOGLE_GEOCODING_API_KEY

const GEOCODE_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

interface GoogleGeocodeLocation {
    lat: number;
    lng: number;
}

export async function GET(request: Request) {
    const { env } = getCacheContext();
    const cacheManager = new CacheManager(env);

    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');

    if (!city) {
        return NextResponse.json({ error: 'City parameter is required' }, { status: 400 });
    }

    if (!GOOGLE_GEOCODING_API_KEY) {
        return NextResponse.json(
            { error: 'Geocoding service is not properly configured on the server.' },
            { status: 500 }
        );
    }

    // Check KV cache first
    try {
        const cachedLocation = await cacheManager.get<GoogleGeocodeLocation>('GEOCODE_CACHE' as keyof Cloudflare.Env, city);
        if (cachedLocation) {
            // Check if the cached location is the "not found" placeholder
            if (cachedLocation.lat === 0 && cachedLocation.lng === 0) {
                return NextResponse.json({ error: `No geocoding results for ${city} (cached). Google status: ZERO_RESULTS` }, { status: 404 });
            }
            return NextResponse.json(cachedLocation);
        }
    } catch (cacheError) {
        console.error(`Error reading from GEOCODE_CACHE for city ${city}:`, cacheError);
    }

    try {
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${GOOGLE_GEOCODING_API_KEY}`
        );

        if (!response.ok) {
            const errorData = await response.text();
            console.error(`Geocoding API error for ${city}: ${response.status} - ${errorData}`);
            return NextResponse.json(
                { error: `Failed to geocode city: ${response.statusText || response.status}` },
                { status: response.status }
            );
        }

        const data = await response.json();

        if (data.status === 'OK' && data.results && data.results.length > 0) {
            const location = data.results[0].geometry.location as GoogleGeocodeLocation;
            await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, city, location, GEOCODE_CACHE_TTL_SECONDS);
            return NextResponse.json(location);
        } else if (data.status === 'ZERO_RESULTS') {
            const notFoundPlaceholder: GoogleGeocodeLocation = { lat: 0, lng: 0 };
            await cacheManager.put('GEOCODE_CACHE' as keyof Cloudflare.Env, city, notFoundPlaceholder, GEOCODE_CACHE_TTL_SECONDS);
            return NextResponse.json({ error: `No geocoding results for ${city}. Google status: ${data.status}` }, { status: 404 });
        } else {
            console.error(`Geocoding API error for ${city}: ${data.status}. Error message: ${data.error_message || 'No additional error message provided.'}`);
            return NextResponse.json(
                { error: `Geocoding failed for ${city}. Google status: ${data.status}`, details: data.error_message },
                { status: 500 }
            );
        }
    } catch (error) {
        console.error(`Network or other error geocoding ${city}:`, error);
        // Try to provide more specific error information if available
        const errorMessage = error instanceof Error ? error.message : 'Internal server error during geocoding';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}