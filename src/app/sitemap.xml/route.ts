import { DiscordChannel } from '@/lib/types/core'
import { NextResponse } from 'next/server'

const BASE_URL = 'https://news.fasttakeoff.org'

// In-memory cache for sitemap
let cachedSitemap: string | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for testing

interface SitemapUrl {
    url: string
    lastModified: string
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
    priority: number
}

function generateStaticSitemap(): string {
    const urls: SitemapUrl[] = []
    const now = new Date().toISOString()

    // Static pages - these are the core pages that should always be available
    const staticPages = [
        { path: '', priority: 1.0, changeFreq: 'daily' as const },
        { path: '/current-events', priority: 0.9, changeFreq: 'hourly' as const },
        { path: '/executive-orders', priority: 0.9, changeFreq: 'daily' as const },
        { path: '/brazil-news', priority: 0.8, changeFreq: 'daily' as const },
        { path: '/news-globe', priority: 0.7, changeFreq: 'daily' as const },
        { path: '/privacy-policy', priority: 0.3, changeFreq: 'monthly' as const },
    ]

    staticPages.forEach(page => {
        urls.push({
            url: `${BASE_URL}${page.path}`,
            lastModified: now,
            changeFrequency: page.changeFreq,
            priority: page.priority
        })
    })

    // Generate XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFrequency}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`

    return sitemap
}

async function updateCacheInBackground() {
    console.log('Starting sitemap background update...')
    try {
        // Import expensive operations only when updating cache
        const { ReportService } = await import('@/lib/data/report-service')
        const { getCacheContext } = await import('@/lib/utils')

        const urls: SitemapUrl[] = []
        const now = new Date().toISOString()

        // Static pages first
        const staticPages = [
            { path: '', priority: 1.0, changeFreq: 'daily' as const },
            { path: '/current-events', priority: 0.9, changeFreq: 'hourly' as const },
            { path: '/executive-orders', priority: 0.9, changeFreq: 'daily' as const },
            { path: '/brazil-news', priority: 0.8, changeFreq: 'daily' as const },
            { path: '/news-globe', priority: 0.7, changeFreq: 'daily' as const },
            { path: '/privacy-policy', priority: 0.3, changeFreq: 'monthly' as const },
        ]

        staticPages.forEach(page => {
            urls.push({
                url: `${BASE_URL}${page.path}`,
                lastModified: now,
                changeFrequency: page.changeFreq,
                priority: page.priority
            })
        })

        // Executive Orders - skip due to geo-fencing issues
        // Focus on reports which are the main content
        try {
            console.log('Skipping executive orders due to geo-fencing, proceeding to reports...')
            // Skip executive orders entirely for now
        } catch (error) {
            console.error('Error fetching executive orders for sitemap cache:', error)
        }

        // Reports - using direct KV access to avoid Discord API calls
        try {
            console.log('Getting Cloudflare context...')
            // Access Cloudflare context in production runtime
            const { env } = await getCacheContext()
            console.log('Cloudflare context obtained:', !!env)
            if (env && env.REPORTS_CACHE && env.CHANNELS_CACHE) {
                console.log('Using direct KV access for sitemap generation...')

                // Read channels directly from KV cache (bypass Discord API)
                const channelsKey = `channels:guild:${env.DISCORD_GUILD_ID}`
                const cachedChannelsData = await env.CHANNELS_CACHE.get(channelsKey, 'json') as { channels: DiscordChannel[] }

                if (cachedChannelsData && cachedChannelsData.channels) {
                    const channels = cachedChannelsData.channels
                    console.log(`Found ${channels.length} cached channels`)

                    const reportService = new ReportService(env)
                    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

                    // Process all channels but with reasonable limits
                    for (const channel of channels) {
                        try {
                            console.log(`Processing channel ${channel.id} (${channel.name})...`)
                            const reports = await reportService.getAllReportsForChannel(channel.id)
                            console.log(`Found ${reports?.length || 0} reports for channel ${channel.id}`)
                            if (reports) {
                                // Add channel page
                                urls.push({
                                    url: `${BASE_URL}/current-events/${channel.id}`,
                                    lastModified: now,
                                    changeFrequency: 'hourly',
                                    priority: 0.7
                                })

                                // Add reports from last year (max 200 per channel)
                                const recentReports = reports
                                    .filter(report => new Date(report.generatedAt) >= oneYearAgo)
                                    .slice(0, 200)

                                console.log(`After filtering: ${recentReports.length} recent reports for channel ${channel.id}`)

                                recentReports.forEach(report => {
                                    urls.push({
                                        url: `${BASE_URL}/current-events/${report.channelId}/${report.reportId}`,
                                        lastModified: report.generatedAt,
                                        changeFrequency: 'daily',
                                        priority: 0.8
                                    })
                                })
                            }
                        } catch (error) {
                            console.error(`Error fetching reports for channel ${channel.id}:`, error)
                        }
                    }
                } else {
                    console.log('No cached channels found, skipping dynamic content')
                }
            } else {
                console.log('Missing env.REPORTS_CACHE or env.CHANNELS_CACHE')
            }
        } catch (error) {
            console.error('Error updating sitemap cache:', error)
        }

        console.log(`Total URLs generated: ${urls.length}`)

        // Generate and cache new sitemap
        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastModified}</lastmod>
    <changefreq>${url.changeFrequency}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`

        cachedSitemap = sitemap
        cacheTimestamp = Date.now()
        console.log(`Sitemap cache updated successfully with ${urls.length} URLs`)
    } catch (error) {
        console.error('Error updating sitemap cache (outer catch):', error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    }
}

export async function GET(request: Request) {
    try {
        const now = Date.now()
        const url = new URL(request.url)
        const forceRefresh = url.searchParams.get('fresh') === 'true'

        // Check if cache is valid
        const cacheIsValid = cachedSitemap && (now - cacheTimestamp) < CACHE_DURATION && !forceRefresh

        if (!cacheIsValid) {
            console.log('Cache invalid, starting background update...', { forceRefresh, cacheAge: now - cacheTimestamp })
            // If no cache or cache expired, start background update
            if (!cachedSitemap) {
                console.log('No cached sitemap, generating static fallback...')
                // First time - return static sitemap immediately
                cachedSitemap = generateStaticSitemap()
                cacheTimestamp = now
            }

            // Update cache in background (don't await)
            updateCacheInBackground().catch(console.error)
        } else {
            console.log('Serving cached sitemap', { cacheAge: now - cacheTimestamp, cacheValid: cacheIsValid })
        }

        return new NextResponse(cachedSitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            },
        })
    } catch (error) {
        console.error('Error serving sitemap:', error)

        // Fallback to static sitemap on any error
        const fallbackSitemap = generateStaticSitemap()
        return new NextResponse(fallbackSitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=1800, s-maxage=1800', // 30 min cache on errors
            },
        })
    }
}

export const dynamic = 'force-dynamic'