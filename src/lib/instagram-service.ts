import { URLs } from './config';
import { Report } from './types/core';
interface InstagramPostPayload {
    newsTitle: string;
    newsContent: string;
    imageUrl?: string;
}

const BRAIN_IMAGE_URL = URLs.BRAIN_IMAGE;
const INSTAGRAM_WORKER_URL = URLs.INSTAGRAM_WORKER;

export class InstagramService {
    async postNews(report: Report): Promise<void> {
        if (!report || !report.headline || !report.body) {
            console.warn('[INSTAGRAM] Invalid report data received, skipping post.');
            return;
        }

        const payload: InstagramPostPayload = {
            newsTitle: report.headline,
            newsContent: report.body,
            imageUrl: BRAIN_IMAGE_URL,
        };

        console.log(`[INSTAGRAM] Attempting to post report ID: ${report.reportId}`);

        try {
            console.log(`[INSTAGRAM] Using fetch to post to: ${INSTAGRAM_WORKER_URL}`);
            const response = await fetch(INSTAGRAM_WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const responseData = await response.json() as { mediaId?: string };

            if (!response.ok) {
                console.error(`[INSTAGRAM] Error posting report ${report.reportId}. Status: ${response.status}`, responseData);
                throw new Error(`Instagram Worker request failed: ${response.status}`);
            }

            console.log(`[INSTAGRAM] Successfully posted report ${report.reportId}. Media ID: ${responseData.mediaId || 'N/A'}`);
        } catch (error) {
            console.error(`[INSTAGRAM] Failed to post report ${report.reportId}:`, error);
        }
    }
}