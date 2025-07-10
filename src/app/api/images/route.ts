import { withErrorHandling } from '@/lib/api-utils';
import { ImageService } from '@/lib/utils/image-service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    return withErrorHandling(async (env) => {
        const { headline } = await request.json();

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