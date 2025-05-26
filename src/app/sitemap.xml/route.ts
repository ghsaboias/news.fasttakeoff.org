import { fetchExecutiveOrders } from '@/lib/data/executive-orders'
import { Report } from '@/lib/types/core'
import { getStartDate } from '@/lib/utils'
import { NextResponse } from 'next/server'

const BASE_URL = 'https://news.fasttakeoff.org'

interface SitemapUrl {
    url: string
    lastModified: string
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
    priority: number
}

export async function GET() {
    try {
        const urls: SitemapUrl[] = []

        // Static pages
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
                lastModified: new Date().toISOString(),
                changeFrequency: page.changeFreq,
                priority: page.priority
            })
        })

        // Executive Orders - fetch recent ones (last 6 months)
        try {
            const startDate = getStartDate(180) // Last 6 months
            const { orders } = await fetchExecutiveOrders(1, startDate) // Get first page of orders

            orders.forEach(order => {
                urls.push({
                    url: `${BASE_URL}/executive-orders/${order.id}`,
                    lastModified: order.publication?.publicationDate || order.date || new Date().toISOString(),
                    changeFrequency: 'weekly',
                    priority: 0.8
                })
            })
        } catch (error) {
            console.error('Error fetching executive orders for sitemap:', error)
        }

        // Reports - fetch from API
        try {
            const reportsResponse = await fetch(`${BASE_URL}/api/reports`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Sitemap Generator'
                }
            })

            if (reportsResponse.ok) {
                const reports = await reportsResponse.json() as Report[]

                // Add channel pages
                const channelIds = new Set(reports.map(report => report.channelId).filter(Boolean))
                channelIds.forEach(channelId => {
                    if (channelId) {
                        urls.push({
                            url: `${BASE_URL}/current-events/${channelId}`,
                            lastModified: new Date().toISOString(),
                            changeFrequency: 'hourly',
                            priority: 0.7
                        })
                    }
                })

                // Add individual report pages
                reports.forEach(report => {
                    if (report.channelId && report.reportId) {
                        urls.push({
                            url: `${BASE_URL}/current-events/${report.channelId}/${report.reportId}`,
                            lastModified: report.generatedAt || new Date().toISOString(),
                            changeFrequency: 'daily',
                            priority: 0.6
                        })
                    }
                })
            }
        } catch (error) {
            console.error('Error fetching reports for sitemap:', error)
        }

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

        return new NextResponse(sitemap, {
            headers: {
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
            },
        })
    } catch (error) {
        console.error('Error generating sitemap:', error)
        return new NextResponse('Error generating sitemap', { status: 500 })
    }
} 