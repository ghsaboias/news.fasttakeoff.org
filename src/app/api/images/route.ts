import { withErrorHandling } from '@/lib/api-utils';
import { ImageService } from '@/lib/utils/image-service';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/images
 * Generates a PNG image for a given news headline.
 * @param request - JSON body: { headline: string }
 * @returns {Promise<NextResponse<Buffer> | NextResponse<{ error: string }>>}
 * @throws 400 if headline is missing/invalid, 500 for image generation errors.
 * @auth None required.
 * @integration Uses ImageService.
 */
export async function POST(request: NextRequest) {
    return withErrorHandling(async (env) => {
        const body = await request.json() as { headline?: string };
        const { headline } = body;

        if (!headline || typeof headline !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid headline' }, { status: 400 });
        }

        const imageService = new ImageService(env);
        const imageBuffer = await imageService.generateImage(headline);

        // Return NextResponse directly with the image buffer
        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    }, 'Failed to generate image');
} 