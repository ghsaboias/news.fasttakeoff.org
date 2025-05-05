import { Cloudflare } from '../../worker-configuration';
import { URLs } from './config';
import { Report } from './types/core';
const BRAIN_IMAGE_URL = URLs.BRAIN_IMAGE;

// Instagram API constants
const INSTAGRAM_ACCOUNT_ID = '9985118404840500';
const INSTAGRAM_CREATE_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media`;
const INSTAGRAM_PUBLISH_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;

export class InstagramService {
    private readonly accessToken: string;

    constructor(env: Cloudflare.Env) {
        this.accessToken = env.INSTAGRAM_ACCESS_TOKEN || '';
        if (!this.accessToken) {
            console.warn('[INSTAGRAM] No access token found in environment');
        }
    }

    async postNews(report: Report): Promise<void> {
        if (!report || !report.headline || !report.body) {
            console.warn('[INSTAGRAM] Invalid report data received, skipping post.');
            return;
        }

        if (!this.accessToken) {
            console.error('[INSTAGRAM] Cannot post to Instagram: Missing access token');
            return; // Consider throwing an error instead to fail fast
        }

        console.log(`[INSTAGRAM] Posting to Instagram API for report ID: ${report.reportId}`);

        try {
            // Step 1: Create media container
            const createMediaPayload = {
                image_url: BRAIN_IMAGE_URL,
                caption: `${report.headline}\n\n${report.body}`.slice(0, 2200),
                access_token: this.accessToken,
            };

            console.log(`[INSTAGRAM] Creating media container for report: ${report.reportId}`);
            const createMediaResponse = await fetch(INSTAGRAM_CREATE_MEDIA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createMediaPayload),
            });

            if (!createMediaResponse.ok) {
                const errorText = await createMediaResponse.text();
                throw new Error(`Failed to create media: ${createMediaResponse.status}. ${errorText}`);
            }

            let createMediaResult;
            try {
                createMediaResult = await createMediaResponse.json();
            } catch (error) {
                const responseText = await createMediaResponse.text();
                throw new Error(`Failed to parse create media response: ${responseText}. Error: ${error}`);
            }

            if (!createMediaResult.id) {
                throw new Error(createMediaResult.error?.message || 'Failed to create media container');
            }

            console.log(`[INSTAGRAM] Media container created: ${createMediaResult.id}`);

            // Step 2: Publish media
            const publishPayload = {
                creation_id: createMediaResult.id,
                access_token: this.accessToken,
            };

            const publishResponse = await fetch(INSTAGRAM_PUBLISH_MEDIA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(publishPayload),
            });

            if (!publishResponse.ok) {
                const errorText = await publishResponse.text();
                throw new Error(`Failed to publish media: ${publishResponse.status}. ${errorText}`);
            }

            let publishResult;
            try {
                publishResult = await publishResponse.json();
            } catch (error) {
                const responseText = await publishResponse.text();
                throw new Error(`Failed to parse publish response: ${responseText}. Error: ${error}`);
            }

            if (publishResult.id) {
                console.log(`[INSTAGRAM] Successfully posted report ${report.reportId}. Media ID: ${publishResult.id}`);
            } else {
                throw new Error(publishResult.error?.message || 'Failed to publish media');
            }
        } catch (error) {
            console.error(`[INSTAGRAM] Failed to post report ${report.reportId}:`, error);
            throw error; // Rethrow to allow caller to handle
        }
    }
}