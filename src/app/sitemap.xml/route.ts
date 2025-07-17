import { SitemapService } from '@/lib/data/sitemap-service'
import { getCacheContext } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function GET() {
    try {
        console.log('[SITEMAP] Serving sitemap request')

        const { env } = await getCacheContext()

        if (!env) {
            console.log('[SITEMAP] No Cloudflare context, serving static fallback')
            // Fallback to static sitemap when no context
            const staticSitemap = generateStaticSitemap()
            return new NextResponse(staticSitemap, {
                headers: {
                    'Content-Type': 'application/xml; charset=utf-8',
                    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
                },
            })
        }

        const sitemapService = new SitemapService(env)
        const sitemap = await sitemapService.getCachedSitemap()

        return new NextResponse(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
            },
        })
    } catch (error) {
        console.error('[SITEMAP] Error serving sitemap:', error)

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

function generateStaticSitemap(): string {
    const BASE_URL = 'https://news.fasttakeoff.org'
    const now = new Date().toISOString()

    const staticPages = [
        { path: '', priority: 1.0, changeFreq: 'daily' },
        { path: '/current-events', priority: 0.9, changeFreq: 'hourly' },
        { path: '/executive-orders', priority: 0.9, changeFreq: 'daily' },
        { path: '/brazil', priority: 0.8, changeFreq: 'daily' },
        { path: '/news-globe', priority: 0.7, changeFreq: 'daily' },
        { path: '/privacy-policy', priority: 0.3, changeFreq: 'monthly' },
    ]

    const urls = staticPages.map(page => `  <url>
    <loc>${BASE_URL}${page.path}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changeFreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}

export const dynamic = 'force-dynamic'
