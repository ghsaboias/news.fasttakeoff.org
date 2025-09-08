import { withErrorHandling } from '@/lib/api-utils';
import { OpenRouterImageService } from '@/lib/openrouter-image-service';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/images/gemini
 * Generates images using Gemini via OpenRouter and returns the image URL
 * @param request - JSON body: { headline: string, city?: string, customPrompt?: string }
 * @returns {Promise<NextResponse<{ imageUrl: string }> | NextResponse<{ error: string }>>}
 * @throws 400 if headline is missing/invalid, 500 for image generation errors.
 * @auth None required.
 * @integration Uses OpenRouterImageService with Gemini.
 */
export async function POST(request: NextRequest) {
    return withErrorHandling(async (env) => {
        const body = await request.json() as { headline?: string; city?: string; customPrompt?: string };
        const { headline, city = 'Generic City', customPrompt } = body;

        if (!headline || typeof headline !== 'string') {
            return NextResponse.json({ error: 'Missing or invalid headline' }, { status: 400 });
        }

        try {
            const imageService = new OpenRouterImageService(env);
            let imageUrl: string;
            
            if (customPrompt) {
                // Use custom prompt for carousel generation - pass as headline to generateNewsBackground
                imageUrl = await imageService.generateNewsBackground(customPrompt, city);
            } else {
                // Use headline for standard generation
                imageUrl = await imageService.generateNewsBackground(headline, city);
            }

            return NextResponse.json({ imageUrl }, {
                headers: {
                    'Cache-Control': 'public, max-age=3600'
                }
            });

        } catch (error) {
            console.error('[GEMINI] Image generation failed:', error);
            return NextResponse.json(
                { error: error instanceof Error ? error.message : 'Failed to generate image' },
                { status: 500 }
            );
        }
    }, 'Failed to generate Gemini image');
}