import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { newsTitle, newsContent, imageUrl } = await request.json();

        if (!newsTitle || !newsContent) {
            return NextResponse.json(
                { error: 'Missing newsTitle or newsContent' },
                { status: 400 }
            );
        }

        // Get environment variables
        const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
        if (!ACCESS_TOKEN) {
            throw new Error('Missing INSTAGRAM_ACCESS_TOKEN environment variable');
        }

        const instagramAccountId = '9985118404840500';
        const createMediaUrl = `https://graph.instagram.com/v20.0/${instagramAccountId}/media`;
        const mediaPayload = {
            image_url: imageUrl,
            caption: `${newsTitle}\n\n${newsContent}`,
            access_token: ACCESS_TOKEN,
        };

        const createMediaResponse = await fetch(createMediaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mediaPayload),
        });

        const createMediaResult = await createMediaResponse.json();
        if (!createMediaResult.id) {
            throw new Error(createMediaResult.error?.message || 'Failed to create media container');
        }
        console.log('[INSTAGRAM] Created media container:', createMediaResult);

        const publishMediaUrl = `https://graph.instagram.com/v20.0/${instagramAccountId}/media_publish`;
        const publishPayload = {
            creation_id: createMediaResult.id,
            access_token: ACCESS_TOKEN,
        };

        const publishResponse = await fetch(publishMediaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(publishPayload),
        });

        const publishResult = await publishResponse.json();
        if (publishResult.id) {
            return NextResponse.json({
                message: 'Posted to Instagram',
                mediaId: publishResult.id
            });
        } else {
            throw new Error(publishResult.error?.message || 'Failed to publish media');
        }
    } catch (error: unknown) {
        console.error('[INSTAGRAM] Error posting to Instagram:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to post to Instagram' },
            { status: 500 }
        );
    }
} 