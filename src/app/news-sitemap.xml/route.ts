import { getChannels } from '@/lib/data/channels-service';
import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { getCacheContext } from '@/lib/utils';
import { NextResponse } from 'next/server';

const BASE_URL = 'https://news.fasttakeoff.org';

// Cache for 15 minutes - news moves fast
let cachedNewsSitemap: string | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

export async function GET() {
    try {
        const now = Date.now();

        // Check if cache is valid
        const cacheIsValid = cachedNewsSitemap && (now - cacheTimestamp) < CACHE_DURATION;

        if (!cacheIsValid) {
            cachedNewsSitemap = await generateNewsSitemap();
            cacheTimestamp = now;
        }

        return new NextResponse(cachedNewsSitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=900, s-maxage=900', // 15 minutes
            },
        });
    } catch (error) {
        console.error('Error serving news sitemap:', error);

        // Return minimal news sitemap on error
        const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
</urlset>`;

        return new NextResponse(fallbackSitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=300', // 5 min on error
            },
        });
    }
}

async function generateNewsSitemap(): Promise<string> {
    try {
        const { env } = await getCacheContext();

        if (!env || !env.REPORTS_CACHE || !env.CHANNELS_CACHE) {
            throw new Error('Cloudflare environment not available');
        }

        const reportGeneratorService = new ReportGeneratorService(env);
        const channels = await getChannels(env);

        // Get reports from last 48 hours only (Google News requirement)
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
        const newsUrls: Array<{
            url: string;
            lastModified: string;
            title: string;
            channelName: string;
        }> = [];

        // Process only first 10 channels to keep sitemap manageable
        for (const channel of channels.slice(0, 10)) {
            try {
                const reports = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channel.id);

                if (reports) {
                    // Filter for recent reports only
                    const recentReports = reports
                        .filter(report => new Date(report.generatedAt) >= twoDaysAgo)
                        .slice(0, 100); // Max 100 per channel for performance

                    recentReports.forEach(report => {
                        newsUrls.push({
                            url: `${BASE_URL}/current-events/${report.channelId}/${report.reportId}`,
                            lastModified: report.generatedAt,
                            title: report.headline || `Breaking: ${channel.name} Report`,
                            channelName: channel.name
                        });
                    });
                }
            } catch (error) {
                console.error(`Error processing channel ${channel.id} for news sitemap:`, error);
            }
        }

        // Sort by most recent first and limit to 1000 URLs (Google limit)
        newsUrls.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
        const limitedUrls = newsUrls.slice(0, 1000);

        // Generate news sitemap XML
        const newsSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${limitedUrls.map(item => `  <url>
    <loc>${item.url}</loc>
    <news:news>
      <news:publication>
        <news:name>Fast Takeoff News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${item.lastModified}</news:publication_date>
      <news:title><![CDATA[${item.title}]]></news:title>
      <news:keywords>breaking news, real-time news, ${item.channelName}</news:keywords>
    </news:news>
    <lastmod>${item.lastModified}</lastmod>
    <changefreq>never</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
</urlset>`;

        console.log(`Generated news sitemap with ${limitedUrls.length} URLs`);
        return newsSitemap;

    } catch (error) {
        console.error('Error generating news sitemap:', error);
        throw error;
    }
} 