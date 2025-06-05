import { Cloudflare } from '../../worker-configuration';
import { URLs } from './config';
import { Report } from './types/core';
const WEBSITE_URL = URLs.WEBSITE_URL;

// Instagram API constants
const INSTAGRAM_ACCOUNT_ID = '9985118404840500';
const INSTAGRAM_CREATE_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media`;
const INSTAGRAM_PUBLISH_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;
const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

// R2 image retention period (7 days)
const IMAGE_RETENTION_SECONDS = 60 * 60 * 24 * 7;

// Browser Rendering API constants
const BROWSER_RENDERING_API = 'https://api.cloudflare.com/client/v4/accounts';

// Helper function to generate hashtags from channel name
function generateHashtagsFromChannelName(channelName: string): string[] {
    if (!channelName) return [];

    // Remove leading emojis (simple regex, might need refinement for all emojis)
    let cleanName = channelName.replace(/^[^\w\s]+/, '');
    // Remove other special characters, split by hyphen or space, and filter
    cleanName = cleanName.replace(/[^\w\s-]/g, ''); // Keep hyphens for now to split by them

    const words = cleanName
        .split(/[\s-]+/) // Split by space or hyphen
        .map(word => word.toLowerCase().trim())
        .filter(word => word.length > 2); // Filter out very short words

    // Create unique hashtags
    return [...new Set(words.map(word => `#${word}`))];
}

export class InstagramService {
    private readonly accessToken: string;
    private readonly env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.accessToken = env.INSTAGRAM_ACCESS_TOKEN || '';
        this.env = env;
        if (!this.accessToken) {
            console.warn('[INSTAGRAM] No access token found in environment');
        }
    }

    private async generateAndStoreImage(report: Report): Promise<string> {
        console.log(`[INSTAGRAM] Starting image generation for report ${report.reportId}`);

        try {
            // Step 1: Generate SVG via service binding
            const svgStartTime = Date.now();
            const svgRequest = new Request(
                `https://internal/?headline=${encodeURIComponent(report.headline)}`,
                { method: 'GET' }
            );

            console.log(`[INSTAGRAM] Calling SVG worker via service binding`);
            const svgResponse = await this.env.SVG_WORKER.fetch(svgRequest.url);

            if (!svgResponse.ok) {
                throw new Error(`SVG generation failed: ${svgResponse.status} ${svgResponse.statusText}`);
            }

            const svgHtml = await svgResponse.text();
            console.log(`[INSTAGRAM] SVG generated in ${Date.now() - svgStartTime}ms`);

            // Step 2: Generate screenshot via Browser Rendering API
            const screenshotStartTime = Date.now();
            const screenshotUrl = `${BROWSER_RENDERING_API}/${this.env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`;

            console.log(`[INSTAGRAM] Calling Browser Rendering API for screenshot`);
            const screenshotResponse = await fetch(screenshotUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.env.CLOUDFLARE_API_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    html: svgHtml,
                    screenshotOptions: {
                        omitBackground: true,
                        type: 'jpeg',
                        quality: 80,
                    },
                    viewport: {
                        width: 1080,
                        height: 1080,
                    },
                })
            });

            if (!screenshotResponse.ok) {
                const errorText = await screenshotResponse.text();
                throw new Error(`Screenshot generation failed: ${screenshotResponse.status} - ${errorText}`);
            }

            const imageBuffer = await screenshotResponse.arrayBuffer();
            console.log(`[INSTAGRAM] Screenshot generated in ${Date.now() - screenshotStartTime}ms, size: ${imageBuffer.byteLength} bytes`);

            // Step 3: Store in R2
            const r2StartTime = Date.now();
            const r2Key = `${report.reportId}.jpg`;

            const r2UploadResult = await this.env.INSTAGRAM_IMAGES.put(r2Key, imageBuffer, {
                httpMetadata: {
                    contentType: 'image/jpeg',
                    cacheControl: `public, max-age=${IMAGE_RETENTION_SECONDS}`,
                },
                customMetadata: {
                    reportId: report.reportId,
                    headline: report.headline,
                    generatedAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + IMAGE_RETENTION_SECONDS * 1000).toISOString(),
                },
            });

            if (!r2UploadResult) {
                throw new Error('Failed to upload image to R2');
            }

            console.log(`[INSTAGRAM] Image uploaded to R2 in ${Date.now() - r2StartTime}ms, key: ${r2Key}`);

            // Step 4: Generate public URL
            const publicUrl = `${this.env.R2_PUBLIC_URL}/${r2Key}`;
            console.log(`[INSTAGRAM] Public image URL: ${publicUrl}`);

            return publicUrl;

        } catch (error) {
            console.error(`[INSTAGRAM] Image generation failed:`, error);
            throw new Error(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private prepareCaption(report: Report): string {
        const reportLink = `\n\nRead more: ${WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
        const reportLinkCallToAction = "\n\n(Link in bio!)";

        const hashtags = generateHashtagsFromChannelName(report.channelName || '');
        const hashtagsString = hashtags.join(' ');

        const date = new Date(report.generatedAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        // Calculate space needed for fixed elements
        const headerLine = `${report.headline}`;
        const dateCityLine = `${formattedDate} ${formattedTime} - ${report.city}`;
        const footerLines = `${reportLink}${reportLinkCallToAction}${hashtagsString ? `\n\n${hashtagsString}` : ''}`;

        // Calculate available space for body
        const fixedContentLength = headerLine.length + dateCityLine.length + footerLines.length + 8; // +8 for 4 sets of \n\n
        const availableBodyLength = INSTAGRAM_CAPTION_MAX_LENGTH - fixedContentLength;

        // Process body paragraphs
        const paragraphs = report.body.split('\n\n');
        let processedBody = '';

        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const separator = processedBody ? '\n\n' : '';

            if ((processedBody + separator + paragraph).length <= availableBodyLength) {
                processedBody += separator + paragraph;
            } else {
                break;
            }
        }

        // Construct final caption
        return `${headerLine}\n\n${dateCityLine}\n\n${processedBody}\n\n${footerLines}`;
    }

    async postNews(report: Report): Promise<void> {
        if (!report || !report.headline || !report.body || !report.channelName) {
            console.warn('[INSTAGRAM] Invalid report data received, skipping post.');
            return;
        }

        if (!this.accessToken) {
            console.error('[INSTAGRAM] Cannot post to Instagram: Missing access token');
            return;
        }

        console.log(`[INSTAGRAM] Starting post process for report ID: ${report.reportId}`);

        try {
            // Generate and store image
            const imageUrl = await this.generateAndStoreImage(report);

            // Prepare caption
            const caption = this.prepareCaption(report);

            // Create media container
            console.log(`[INSTAGRAM] Creating media container with image URL: ${imageUrl}`);
            const createMediaPayload = {
                image_url: imageUrl,
                caption: caption,
                access_token: this.accessToken,
            };

            const createMediaResponse = await fetch(INSTAGRAM_CREATE_MEDIA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createMediaPayload),
            });

            if (!createMediaResponse.ok) {
                const errorText = await createMediaResponse.text();
                throw new Error(`Failed to create media: ${createMediaResponse.status}. ${errorText}`);
            }

            const createMediaResult = await createMediaResponse.json();
            if (!createMediaResult.id) {
                throw new Error(createMediaResult.error?.message || 'Failed to create media container');
            }

            console.log(`[INSTAGRAM] Media container created: ${createMediaResult.id}`);

            // Publish media
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

            const publishResult = await publishResponse.json();
            if (publishResult.id) {
                console.log(`[INSTAGRAM] Successfully posted report ${report.reportId}. Media ID: ${publishResult.id}`);
            } else {
                throw new Error(publishResult.error?.message || 'Failed to publish media');
            }

        } catch (error) {
            console.error(`[INSTAGRAM] Failed to post report ${report.reportId}:`, error);
            throw error;
        }
    }
}