import { Cloudflare } from '../../../worker-configuration';
import { TIME } from '../config';
import { DiscordChannel } from '../types/discord';
import { ServiceFactory } from '../services/ServiceFactory';

export class SitemapService {
    private env: Cloudflare.Env;
    private factory: ServiceFactory;

    constructor(env: Cloudflare.Env) {
        this.env = env;
        this.factory = ServiceFactory.getInstance(env);
    }

    /**
     * Generates a complete sitemap XML with all static pages and dynamic reports
     */
    async generateFullSitemap(): Promise<string> {
        const BASE_URL = 'https://news.fasttakeoff.org';
        const now = new Date().toISOString();
        const urls: Array<{
            url: string;
            lastModified: string;
            changeFrequency: string;
            priority: number;
        }> = [];

        // Static pages
        const staticPages = [
            { path: '', priority: 1.0, changeFreq: 'daily' },
            { path: '/current-events', priority: 0.9, changeFreq: 'hourly' },
            { path: '/executive-orders', priority: 0.9, changeFreq: 'daily' },
            { path: '/brazil', priority: 0.8, changeFreq: 'daily' },
            { path: '/news-globe', priority: 0.7, changeFreq: 'daily' },
            { path: '/privacy-policy', priority: 0.3, changeFreq: 'monthly' },
        ];

        staticPages.forEach(page => {
            urls.push({
                url: `${BASE_URL}${page.path}`,
                lastModified: now,
                changeFrequency: page.changeFreq,
                priority: page.priority
            });
        });

        // Dynamic content - get channels and reports
        try {
            console.log('[SITEMAP] Getting channels from cache...');
            const channelsKey = `channels:guild:${this.env.DISCORD_GUILD_ID}`;
            const cachedChannelsData = await this.env.CHANNELS_CACHE.get(channelsKey, 'json') as { channels: DiscordChannel[] };

            if (cachedChannelsData && cachedChannelsData.channels) {
                const channels = cachedChannelsData.channels;
                console.log(`[SITEMAP] Found ${channels.length} channels`);

                // Limit to main channels to avoid timeout
                const mainChannels = channels.slice(0, 10);

                for (const channel of mainChannels) {
                    try {
                        console.log(`[SITEMAP] Processing channel ${channel.id} (${channel.name})`);

                        // Add channel page
                        urls.push({
                            url: `${BASE_URL}/current-events/${channel.id}`,
                            lastModified: now,
                            changeFrequency: 'hourly',
                            priority: 0.7
                        });

                        // Get reports for this channel
                        const reportService = this.factory.createReportService();
                        const reports = await reportService.getAllReportsForChannel(channel.id);

                        if (reports && reports.length > 0) {
                            // Add all reports (keeping indefinitely now)
                            const recentReports = reports.slice(0, 100); // Limit to 100 per channel for sitemap performance

                            console.log(`[SITEMAP] Adding ${recentReports.length} reports for channel ${channel.id}`);

                            recentReports.forEach(report => {
                                urls.push({
                                    url: `${BASE_URL}/current-events/${report.channelId}/${report.reportId}`,
                                    lastModified: report.generatedAt,
                                    changeFrequency: 'daily',
                                    priority: 0.8
                                });
                            });
                        }
                    } catch (error) {
                        console.error(`[SITEMAP] Error processing channel ${channel.id}:`, error);
                    }
                }
            } else {
                console.log('[SITEMAP] No cached channels found');
            }
        } catch (error) {
            console.error('[SITEMAP] Error getting dynamic content:', error);
        }

        console.log(`[SITEMAP] Generated sitemap with ${urls.length} URLs`);

        // Generate XML
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFrequency}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        return sitemap;
    }

    /**
     * Generates and stores the sitemap in cache
     */
    async updateSitemapCache(): Promise<void> {
        try {
            console.log('[SITEMAP] Generating fresh sitemap...');
            const sitemap = await this.generateFullSitemap();

            // Store in KV cache with 1 week TTL
            await this.env.SITEMAP_CACHE.put('sitemap:xml', sitemap, {
                expirationTtl: TIME.WEEK_SEC // 1 week
            });

            console.log('[SITEMAP] Sitemap cached successfully');
        } catch (error) {
            console.error('[SITEMAP] Error updating sitemap cache:', error);
            throw error;
        }
    }

    /**
     * Gets the cached sitemap or generates a fallback
     */
    async getCachedSitemap(): Promise<string> {
        try {
            const cached = await this.env.SITEMAP_CACHE.get('sitemap:xml');
            if (cached) {
                console.log('[SITEMAP] Serving cached sitemap');
                return cached;
            }
        } catch (error) {
            console.error('[SITEMAP] Error getting cached sitemap:', error);
        }

        // Fallback to static sitemap
        console.log('[SITEMAP] No cached sitemap, generating static fallback');
        return this.generateStaticSitemap();
    }

    /**
     * Generates a minimal static sitemap as fallback
     */
    private generateStaticSitemap(): string {
        const BASE_URL = 'https://news.fasttakeoff.org';
        const now = new Date().toISOString();

        const staticPages = [
            { path: '', priority: 1.0, changeFreq: 'daily' },
            { path: '/current-events', priority: 0.9, changeFreq: 'hourly' },
            { path: '/executive-orders', priority: 0.9, changeFreq: 'daily' },
            { path: '/brazil', priority: 0.8, changeFreq: 'daily' },
            { path: '/news-globe', priority: 0.7, changeFreq: 'daily' },
            { path: '/privacy-policy', priority: 0.3, changeFreq: 'monthly' },
        ];

        const urls = staticPages.map(page => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changeFreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
    }
}
