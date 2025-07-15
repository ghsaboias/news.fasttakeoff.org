import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

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
            console.warn('[API /geo] CF-IPCountry header not found. Assuming non-US (or local dev).');
            return NextResponse.json({ country: 'XX' });
        }

        return NextResponse.json({ country });
    } catch (error) {
        console.error('[API /geo] Error fetching geo data:', error);
        return NextResponse.json(
            { message: 'Failed to determine location', error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
} 