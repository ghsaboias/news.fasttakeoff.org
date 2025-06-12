import { NextResponse } from 'next/server'

const BASE_URL = 'https://news.fasttakeoff.org'

// In-memory cache for sitemap
let cachedSitemap: string | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

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
        const { getChannels } = await import('@/lib/data/channels-service')
        const { fetchExecutiveOrders } = await import('@/lib/data/executive-orders')
        const { ReportGeneratorService } = await import('@/lib/data/report-generator-service')
        const { getCacheContext, getStartDate } = await import('@/lib/utils')

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

        // Executive Orders - limit to recent ones only
        try {
            const startDate = getStartDate(30) // Last 30 days only
            const { orders } = await fetchExecutiveOrders(1, startDate)

            // Limit to first 20 orders
            orders.slice(0, 20).forEach(order => {
                urls.push({
                    url: `${BASE_URL}/executive-orders/${order.id}`,
                    lastModified: order.publication?.publicationDate || order.date || now,
                    changeFrequency: 'weekly',
                    priority: 0.8
                })
            })
        } catch (error) {
            console.error('Error fetching executive orders for sitemap cache:', error)
        }

        // Reports - limit scope significantly
        try {
            console.log('Getting Cloudflare context...')
            // Access Cloudflare context in production runtime
            const { env } = await getCacheContext()
            console.log('Cloudflare context obtained:', !!env)
            if (env && env.REPORTS_CACHE && env.CHANNELS_CACHE) {
                console.log('Creating ReportGeneratorService...')
                const reportGeneratorService = new ReportGeneratorService(env)
                console.log('Getting channels...')
                const channels = await getChannels(env)
                console.log(`Found ${channels.length} channels`)
                const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

                // Process only first 5 channels to limit execution time
                for (const channel of channels.slice(0, 5)) {
                    try {
                        console.log(`Processing channel ${channel.id} (${channel.name})...`)
                        const reports = await reportGeneratorService.cacheService.getAllReportsForChannelFromCache(channel.id)
                        console.log(`Found ${reports?.length || 0} reports for channel ${channel.id}`)
                        if (reports) {
                            // Add channel page
                            urls.push({
                                url: `${BASE_URL}/current-events/${channel.id}`,
                                lastModified: now,
                                changeFrequency: 'hourly',
                                priority: 0.7
                            })

                            // Add only very recent reports (last 30 days, max 100 per channel)
                            const recentReports = reports
                                .filter(report => new Date(report.generatedAt) >= thirtyDaysAgo)
                                .slice(0, 100)
                            
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

export async function GET() {
    try {
        const now = Date.now()

        // Check if cache is valid
        const cacheIsValid = cachedSitemap && (now - cacheTimestamp) < CACHE_DURATION

        if (!cacheIsValid) {
            // If no cache or cache expired, start background update
            if (!cachedSitemap) {
                // First time - return static sitemap immediately
                cachedSitemap = generateStaticSitemap()
                cacheTimestamp = now
            }

            // Update cache in background (don't await)
            updateCacheInBackground().catch(console.error)
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