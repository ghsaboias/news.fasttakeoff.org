import { Cloudflare } from '../../worker-configuration';
import { URLs } from './config';
import { Report } from './types/core';
const WEBSITE_URL = URLs.WEBSITE_URL;

// Instagram API constants
const INSTAGRAM_ACCOUNT_ID = '9985118404840500';
const INSTAGRAM_CREATE_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media`;
const INSTAGRAM_PUBLISH_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;
const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

// Worker URLs
const SVG_GENERATOR_URL = 'https://svg-generator.gsaboia.workers.dev';
const BROWSER_WORKER_URL = 'https://browser-worker.gsaboia.workers.dev';

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

    constructor(env: Cloudflare.Env) {
        this.accessToken = env.INSTAGRAM_ACCESS_TOKEN || '';
        if (!this.accessToken) {
            console.warn('[INSTAGRAM] No access token found in environment');
        }
    }

    async postNews(report: Report): Promise<void> {
        if (!report || !report.headline || !report.body || !report.channelName) {
            console.warn('[INSTAGRAM] Invalid report data received (missing headline, body, or channelName), skipping post.');
            return;
        }

        if (!this.accessToken) {
            console.error('[INSTAGRAM] Cannot post to Instagram: Missing access token');
            return; // Consider throwing an error instead to fail fast
        }

        console.log(`[INSTAGRAM] Posting to Instagram API for report ID: ${report.reportId}`);

        try {
            // Generate URLs for image creation
            const svgUrl = `${SVG_GENERATOR_URL}/?headline=${encodeURIComponent(report.headline)}`;
            const screenshotUrl = `${BROWSER_WORKER_URL}/?url=${encodeURIComponent(svgUrl)}`;

            console.log(`[INSTAGRAM] DEBUG - Headline: "${report.headline}"`);
            console.log(`[INSTAGRAM] DEBUG - SVG URL: ${svgUrl}`);
            console.log(`[INSTAGRAM] DEBUG - Screenshot URL: ${screenshotUrl}`);

            // PRE-GENERATE the screenshot to warm the cache
            console.log(`[INSTAGRAM] Pre-generating screenshot for report: ${report.reportId}`);
            const preGenStart = Date.now();
            try {
                const preGenResponse = await fetch(screenshotUrl);
                const preGenTime = Date.now() - preGenStart;
                console.log(`[INSTAGRAM] Pre-generation completed in ${preGenTime}ms, status: ${preGenResponse.status}`);

                if (!preGenResponse.ok) {
                    throw new Error(`Pre-generation failed: ${preGenResponse.status}`);
                }
            } catch (error) {
                console.error(`[INSTAGRAM] Pre-generation failed for report ${report.reportId}:`, error);
                throw new Error(`Failed to pre-generate screenshot: ${error instanceof Error ? error.message : String(error)}`);
            }

            // Step 1: Create media container
            const reportLink = `\n\nRead more: ${WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
            const reportLinkCallToAction = "\n\n(Link in bio!)";

            const hashtags = generateHashtagsFromChannelName(report.channelName);
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
            const caption = `${headerLine}\n\n${dateCityLine}\n\n${processedBody}\n\n${footerLines}`;

            const createMediaPayload = {
                image_url: screenshotUrl,
                caption: caption,
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