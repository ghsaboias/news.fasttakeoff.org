import { NextResponse } from 'next/server'

const BASE_URL = 'https://news.fasttakeoff.org'

// In-memory cache for sitemap
let cachedSitemap: string | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 1 * 60 * 1000 // 1 minute for testing

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

        // Reports - using API endpoints to get data
        try {
            console.log('Fetching reports from API...')

            // Use internal API to get reports (this works regardless of Cloudflare context)
            const reportsResponse = await fetch(`${BASE_URL}/api/reports?limit=1000`)

            if (reportsResponse.ok) {
                const reportsData = await reportsResponse.json()
                console.log(`Found ${reportsData.length || 0} reports from API`)

                if (Array.isArray(reportsData) && reportsData.length > 0) {
                    // Group reports by channel
                    const channelMap = new Map()

                    reportsData.forEach(report => {
                        if (!channelMap.has(report.channelId)) {
                            channelMap.set(report.channelId, [])
                            // Add channel page
                            urls.push({
                                url: `${BASE_URL}/current-events/${report.channelId}`,
                                lastModified: report.generatedAt || now,
                                changeFrequency: 'hourly',
                                priority: 0.7
                            })
                        }

                        // Add individual report page
                        urls.push({
                            url: `${BASE_URL}/current-events/${report.channelId}/${report.reportId}`,
                            lastModified: report.generatedAt || now,
                            changeFrequency: 'daily',
                            priority: 0.8
                        })
                    })

                    console.log(`Added ${channelMap.size} channels and ${reportsData.length} reports to sitemap`)
                }
            } else {
                console.error('Failed to fetch reports from API:', reportsResponse.status)
            }
        } catch (error) {
            console.error('Error fetching reports from API:', error)
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