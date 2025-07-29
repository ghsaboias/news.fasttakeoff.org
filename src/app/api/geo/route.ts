import { NextRequest, NextResponse } from 'next/server';

// Remove force-dynamic since geo data is stable per location
// export const dynamic = 'force-dynamic';

/**
 * GET /api/geo
 * Returns the user's country code based on the Cloudflare CF-IPCountry header.
 * @returns {Promise<NextResponse<{ country: string } | { message: string; error: string }>>}
 * @throws 500 if header is missing or an error occurs.
 * @auth None required.
 */
export async function GET(request: NextRequest) {
    try {
        // Cloudflare adds the CF-IPCountry header automatically
        const country = request.headers.get('cf-ipcountry')?.toUpperCase();

        if (!country) {
            return NextResponse.json(
                { country: 'XX' },
                {
                    headers: {
                        // Cache for 1 hour since geo location is stable
                        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
                    },
                }
            );
        }

        return NextResponse.json(
            { country },
            {
                headers: {
                    // Cache for 1 hour since geo location is stable
                    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
                },
            }
        );
    } catch (error) {
        console.error('[API /geo] Error fetching geo data:', error);
        return NextResponse.json(
            { message: 'Failed to determine location', error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}