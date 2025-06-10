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

    private calculateFontSize(headline: string): number {
        const words = headline.split(' ');
        const lines = this.breakIntoLines(words, 20); // Using same logic as SVG worker
        const maxLineLength = Math.max(...lines.map(line => line.length));

        const BASE_FONT_SIZE = 60;
        return Math.min(
            BASE_FONT_SIZE,
            (800 / maxLineLength) * 1.5,
            900 / (lines.length * 1.5)
        );
    }

    private breakIntoLines(words: string[], maxLength: number): string[] {
        const lines: string[] = [];
        let currentLine: string[] = [];
        let currentLength = 0;

        for (const word of words) {
            if (currentLength + word.length > maxLength || word.length > maxLength) {
                if (currentLine.length > 0) {
                    lines.push(currentLine.join(' '));
                    currentLine = [];
                    currentLength = 0;
                }

                if (word.length > maxLength) {
                    const chunks = word.match(new RegExp(`.{1,${maxLength}}`, 'g')) || [];
                    lines.push(...chunks);
                } else {
                    currentLine = [word];
                    currentLength = word.length;
                }
            } else {
                currentLine.push(word);
                currentLength += word.length + 1;
            }
        }

        if (currentLine.length > 0) {
            lines.push(currentLine.join(' '));
        }

        return lines;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    private generateHtml(headline: string): string {
        const lines = this.breakIntoLines(headline.split(' '), 20);
        const fontSize = this.calculateFontSize(headline);
        const lineHeight = fontSize * 1.3;

        return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=1080, height=1080">
            <style>
                body { 
                    margin: 0; 
                    padding: 0; 
                    width: 1080px; 
                    height: 1080px; 
                    overflow: hidden;
                    position: relative;
                }
                .background {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-image: url('https://news.fasttakeoff.org/images/brain.png');
                    background-size: cover;
                    background-position: center;
                }
                .overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.4);
                }
                .content-wrapper {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 900px;
                    padding: ${fontSize}px 0;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 10px;
                    text-align: center;
                }
                .headline {
                    color: white;
                    font-family: Arial, sans-serif;
                    font-size: ${fontSize}px;
                    font-weight: bold;
                    line-height: ${lineHeight}px;
                    text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
                    -webkit-text-stroke: 2px black;
                    margin: 0;
                    padding: 0 40px;
                }
            </style>
        </head>
        <body>
            <div class="background"></div>
            <div class="overlay"></div>
            <div class="content-wrapper">
                <div class="headline">${lines.map(line => this.escapeHtml(line)).join('<br>')}</div>
            </div>
        </body>
        </html>`;
    }

    private async generateAndStoreImage(report: Report): Promise<string> {
        console.log(`[INSTAGRAM] Starting image generation for report ${report.reportId}`);

        try {
            // Step 1: Generate HTML directly (no SVG worker needed!)
            const html = this.generateHtml(report.headline);

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
                    html: html,
                    screenshotOptions: {
                        type: 'jpeg',
                        quality: 90,
                        fullPage: false
                    },
                    viewport: {
                        width: 1080,
                        height: 1080,
                        deviceScaleFactor: 1
                    },
                    waitForTimeout: 2000 // Wait 2s for image to load
                })
            });

            if (!screenshotResponse.ok) {
                const errorText = await screenshotResponse.text();
                throw new Error(`Screenshot generation failed: ${screenshotResponse.status} - ${errorText}`);
            }

            const imageBuffer = await screenshotResponse.arrayBuffer();
            console.log(`[INSTAGRAM] Screenshot generated in ${Date.now() - screenshotStartTime}ms, size: ${imageBuffer.byteLength} bytes`);

            // Step 3: Store in R2 (keep this the same)
            const r2StartTime = Date.now();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const r2Key = `instagram/${report.reportId}/${timestamp}.jpg`;

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
            year: 'numeric',
            timeZone: 'UTC' // Force UTC to prevent hydration mismatches
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC' // Force UTC to prevent hydration mismatches
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