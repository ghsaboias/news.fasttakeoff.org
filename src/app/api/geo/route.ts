import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure dynamic execution

export async function GET(request: NextRequest) {
    try {
        // Cloudflare adds the CF-IPCountry header automatically
        const country = request.headers.get('cf-ipcountry')?.toUpperCase();

        // You might want to handle cases where the header is missing (e.g., local dev without Cloudflare)
        // For local dev, you could return a default (like 'US') or an indicator like 'XX'
        if (!country) {
            console.warn('[API /geo] CF-IPCountry header not found. Assuming non-US (or local dev).');
            // Return 'XX' for unknown/local, let client decide how to handle
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