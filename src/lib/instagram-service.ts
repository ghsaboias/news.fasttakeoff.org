import { Cloudflare } from '../../worker-configuration';
import { URLs } from './config';
import { Report } from './types/core';
const BRAIN_IMAGE_URL = URLs.BRAIN_IMAGE;
const WEBSITE_URL = URLs.WEBSITE_URL;

// Instagram API constants
const INSTAGRAM_ACCOUNT_ID = '9985118404840500';
const INSTAGRAM_CREATE_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media`;
const INSTAGRAM_PUBLISH_MEDIA_URL = `https://graph.instagram.com/v20.0/${INSTAGRAM_ACCOUNT_ID}/media_publish`;
const INSTAGRAM_CAPTION_MAX_LENGTH = 2200;

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
            // Step 1: Create media container
            const reportLink = `\\n\\nRead more: ${WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;
            const reportLinkCallToAction = "\\n\\n(Link in bio!)"; // Added call to action

            const hashtags = generateHashtagsFromChannelName(report.channelName);
            const hashtagsString = hashtags.join(' ');
            const hashtagLength = hashtagsString.length > 0 ? hashtagsString.length + 2 : 0; // +2 for \\n\\n before hashtags

            const headlineLength = report.headline.length;
            // Include call to action length
            const overheadLength = headlineLength + reportLink.length + reportLinkCallToAction.length + hashtagLength + 6; // 2 for \\n\\n after headline, 2 for \\n\\n before link, 2 for \\n\\n before call to action

            let processedBody = report.body;
            if (overheadLength + processedBody.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
                const availableBodyLength = INSTAGRAM_CAPTION_MAX_LENGTH - overheadLength;
                if (availableBodyLength < 0) {
                    processedBody = '';
                } else {
                    const paragraphs = processedBody.split('\\n\\n');
                    let currentBody = '';
                    for (let i = 0; i < paragraphs.length; i++) {
                        const paragraph = paragraphs[i];
                        const separator = currentBody ? '\\n\\n' : '';
                        if (currentBody.length + separator.length + paragraph.length <= availableBodyLength) {
                            currentBody += separator + paragraph;
                        } else {
                            break;
                        }
                    }
                    processedBody = currentBody;
                }
            }

            let caption = `${report.headline}\\n\\n${processedBody}${reportLink}${reportLinkCallToAction}`;
            if (hashtags.length > 0) {
                caption += `\\n\\n${hashtagsString}`;
            }

            // Final check for length
            if (caption.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
                // If still too long, we might need to truncate more aggressively or remove hashtags
                // For now, let's try removing hashtags first if the body is already minimal
                if (processedBody.length < report.body.length || processedBody.length === 0) {
                    caption = `${report.headline}\\n\\n${processedBody}${reportLink}${reportLinkCallToAction}`; // Caption without hashtags
                    // If still too long without hashtags, truncate the whole caption
                    if (caption.length > INSTAGRAM_CAPTION_MAX_LENGTH) {
                        caption = caption.slice(0, INSTAGRAM_CAPTION_MAX_LENGTH);
                    }
                } else {
                    // If body wasn't truncated, try removing hashtags and re-check
                    let captionWithoutHashtags = `${report.headline}\\n\\n${processedBody}${reportLink}${reportLinkCallToAction}`;
                    if (captionWithoutHashtags.length <= INSTAGRAM_CAPTION_MAX_LENGTH) {
                        caption = captionWithoutHashtags;
                    } else {
                        // If still too long, truncate the version with hashtags (it implies body is very long)
                        caption = caption.slice(0, INSTAGRAM_CAPTION_MAX_LENGTH);
                    }
                }
            }

            const createMediaPayload = {
                image_url: BRAIN_IMAGE_URL,
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