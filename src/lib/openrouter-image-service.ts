import { Cloudflare } from '../../worker-configuration';
import { OpenRouterImageResponse } from './types/core';

export class OpenRouterImageService {
    private readonly apiKey: string;
    private readonly baseUrl = 'https://openrouter.ai/api/v1/chat/completions';

    constructor(env: Cloudflare.Env) {
        const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

        if (isBuildTime) {
            console.log('[OPENROUTER] Build environment detected, skipping validation');
            this.apiKey = '';
            return;
        }

        this.apiKey = env.OPENROUTER_API_KEY || '';
        if (!this.apiKey) {
            console.warn('[OPENROUTER] No API key found in environment');
        }
    }

    async generateNewsBackground(headline: string, city: string = 'Generic City'): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenRouter API key not configured');
        }

        try {
            const explicitNoTextPrompt = "Create a professional news background inspired by: [HEADLINE]. Set in [CITY] with cinematic lighting, documentary photography style. Clean composition with NO TEXT or words of any kind.";
            const promptText = explicitNoTextPrompt
                .replace('[HEADLINE]', headline)
                .replace('[CITY]', city);

            console.log(`[OPENROUTER] Generating background for headline in ${city}: ${headline}`);

            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'google/gemini-2.5-flash-image-preview',
                    messages: [
                        {
                            role: 'user',
                            content: promptText
                        }
                    ],
                    modalities: ['image', 'text']
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
            }

            const result = await response.json() as OpenRouterImageResponse;
            console.log(`[OPENROUTER] Full API response:`, JSON.stringify(result, null, 2));

            if (!result.choices || !result.choices[0]?.message?.images?.[0]) {
                console.log(`[OPENROUTER] Response structure - choices:`, result.choices ? 'exists' : 'missing');
                if (result.choices?.[0]) {
                    console.log(`[OPENROUTER] Message structure:`, JSON.stringify(result.choices[0].message, null, 2));
                }
                throw new Error('No image generated in OpenRouter response');
            }

            const imageUrl = result.choices[0].message.images[0].image_url.url;
            console.log(`[OPENROUTER] Generated background image (base64 length: ${imageUrl.length})`);

            return imageUrl;

        } catch (error) {
            console.error(`[OPENROUTER] Background generation failed:`, error);
            throw new Error(`Failed to generate background: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}