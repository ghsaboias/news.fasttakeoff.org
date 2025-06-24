import { Cloudflare } from '../../worker-configuration';
import { URLs } from './config';
import { Report } from './types/core';

const WEBSITE_URL = URLs.WEBSITE_URL;

// Facebook API constants
const FACEBOOK_GRAPH_API_VERSION = 'v23.0';
const FACEBOOK_CAPTION_MAX_LENGTH = 63206; // Facebook has a much higher limit than Instagram

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

export class FacebookService {
    private readonly pageAccessToken: string;
    private readonly pageId: string;
    private readonly env: Cloudflare.Env;

    constructor(env: Cloudflare.Env) {
        this.pageAccessToken = env.FACEBOOK_PAGE_ACCESS_TOKEN || '';
        this.pageId = env.FACEBOOK_PAGE_ID || '';
        this.env = env;

        if (!this.pageAccessToken) {
            console.warn('[FACEBOOK] No page access token found in environment');
        }
        if (!this.pageId) {
            console.warn('[FACEBOOK] No page ID found in environment');
        }
    }

    private getPostUrl(): string {
        return `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/${this.pageId}/feed`;
    }

    private prepareMessage(report: Report): string {
        const reportLink = `${WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

        const hashtags = generateHashtagsFromChannelName(report.channelName || '');
        const hashtagsString = hashtags.join(' ');

        const date = new Date(report.generatedAt);
        const formattedDate = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'UTC'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'UTC'
        });

        // Facebook allows much longer posts than Instagram, so we can include more content
        const dateCityLine = `${formattedDate} ${formattedTime} - ${report.city}`;
        const linkSection = `🔗 Read the full report: ${reportLink}`;
        const hashtagSection = hashtagsString ? `\n${hashtagsString}` : '';

        // Calculate if we need to truncate (Facebook has a very high limit, so this is unlikely)
        const sections = [report.headline, dateCityLine, report.body, linkSection, hashtagSection].filter(Boolean);
        const fullMessage = sections.join('\n\n');

        if (fullMessage.length <= FACEBOOK_CAPTION_MAX_LENGTH) {
            return fullMessage;
        }

        // If somehow we exceed the limit, truncate the body
        const fixedSections = [report.headline, dateCityLine, linkSection, hashtagSection].filter(Boolean);
        const fixedLength = fixedSections.join('\n\n').length + 4; // +4 for body section separator
        const availableBodyLength = FACEBOOK_CAPTION_MAX_LENGTH - fixedLength - 20; // -20 for safety margin

        const truncatedBody = report.body.length > availableBodyLength
            ? `📄 ${report.body.slice(0, availableBodyLength)}...`
            : `📄 ${report.body}`;

        return [report.headline, dateCityLine, truncatedBody, linkSection, hashtagSection]
            .filter(Boolean)
            .join('\n\n');
    }

    async postNews(report: Report): Promise<void> {
        if (!report || !report.headline || !report.body || !report.channelName) {
            console.warn('[FACEBOOK] Invalid report data received, skipping post.');
            return;
        }

        if (!this.pageAccessToken || !this.pageId) {
            console.error('[FACEBOOK] Cannot post to Facebook: Missing page access token or page ID');
            return;
        }

        console.log(`[FACEBOOK] Starting post process for report ID: ${report.reportId}`);

        try {
            const message = this.prepareMessage(report);
            const postUrl = this.getPostUrl();

            console.log(`[FACEBOOK] Posting to Facebook page ${this.pageId}`);

            const payload = {
                message: message,
                access_token: this.pageAccessToken,
            };

            const response = await fetch(postUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to post to Facebook: ${response.status} - ${errorText}`);
            }

            const result = await response.json();

            if (result.id) {
                console.log(`[FACEBOOK] Successfully posted report ${report.reportId}. Post ID: ${result.id}`);
            } else {
                throw new Error(result.error?.message || 'Failed to create Facebook post');
            }

        } catch (error) {
            console.error(`[FACEBOOK] Failed to post report ${report.reportId}:`, error);
            throw error;
        }
    }

    async testConnection(): Promise<boolean> {
        if (!this.pageAccessToken || !this.pageId) {
            console.error('[FACEBOOK] Cannot test connection: Missing credentials');
            return false;
        }

        try {
            const testUrl = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}/${this.pageId}?fields=id,name,can_post&access_token=${this.pageAccessToken}`;

            const response = await fetch(testUrl);

            if (!response.ok) {
                console.error(`[FACEBOOK] Connection test failed: ${response.status}`);
                return false;
            }

            const result = await response.json();
            console.log(`[FACEBOOK] Connection test successful. Page: ${result.name}, Can post: ${result.can_post}`);

            return result.can_post === true;
        } catch (error) {
            console.error('[FACEBOOK] Connection test error:', error);
            return false;
        }
    }
} 