import { getAIAPIKey, getAIProviderConfig } from '@/lib/ai-config';
import { parseAIJSON } from '@/lib/utils/json-parser';
import { NextResponse } from 'next/server';

interface TranslationRequest {
    headline?: string;
    city?: string;
    body: string;
    targetLang: string;
}

interface TranslationResponse {
    headline?: string;
    city?: string;
    body: string;
}

/**
 * POST /api/translate
 * Translates a news report or content fields to a target language using an AI provider.
 * @param request - JSON body: { headline?: string, city?: string, body: string, targetLang: string }
 * @returns {Promise<NextResponse<{ translatedContent: TranslationResponse } | { error: string }>>}
 * @throws 400 if required fields are missing, 500 for errors.
 * @auth None required.
 * @integration Uses AI provider for translation.
 */
export async function POST(req: Request) {
    try {
        const { headline, city, body, targetLang } = await req.json() as TranslationRequest;

        if (!body || !targetLang) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const translatedContent = await translateContent({ headline, city, body }, targetLang);

        return NextResponse.json({ translatedContent });
    } catch (error) {
        console.error('Translation API error:', error);
        return NextResponse.json({ error: 'Failed to translate content' }, { status: 500 });
    }
}

async function translateContent(content: Omit<TranslationRequest, 'targetLang'>, targetLang: string): Promise<TranslationResponse> {
    const aiConfig = getAIProviderConfig();
    const apiKey = getAIAPIKey();

    console.log(`Translating content using ${aiConfig.displayName}...`);

    const langMap: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'pt': 'Portuguese'
    };
    const targetLanguageName = langMap[targetLang] || targetLang;

    const startTime = performance.now();

    try {
        const response = await fetch(aiConfig.endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: aiConfig.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a professional translator that responds in JSON. Translate the provided JSON object maintaining its structure. Each field should be accurately translated to the target language while preserving formatting. For the "body" field, maintain paragraph breaks using double newlines (\\n\\n). Respond only with the translated JSON object.'
                    },
                    {
                        role: 'user',
                        content: `Translate the following JSON object to ${targetLanguageName}:\n${JSON.stringify(content, null, 2)}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 1024,
                response_format: { type: "json_object" }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }

        const data = await response.json() as { choices?: { message?: { content?: string } }[] };
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from AI API');
        }

        const translatedContent = parseAIJSON<TranslationResponse>(data.choices[0].message.content);

        if (!translatedContent.body) {
            throw new Error('Translation response missing required field: body');
        }

        const endTime = performance.now();
        console.log(`Translation by ${aiConfig.displayName} completed in ${(endTime - startTime).toFixed(2)}ms`);

        return translatedContent;
    } catch (error) {
        console.error('Translation error:', error);
        if (process.env.NODE_ENV === 'development') {
            return {
                headline: content.headline ? `[${targetLang}] ${content.headline}` : undefined,
                city: content.city ? `[${targetLang}] ${content.city}` : undefined,
                body: `[${targetLang}] ${content.body}`
            };
        }
        throw error;
    }
} 