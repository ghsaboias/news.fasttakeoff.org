import { TIME } from '@/lib/config'
import { getChannels } from '@/lib/data/channels-service'
import { ReportService } from '@/lib/data/report-service'
import { getCacheContext } from '@/lib/utils'

function escapeXml(str: string): string {
    return str.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;'
            case '>': return '&gt;'
            case '&': return '&amp;'
            case "'": return '&apos;'
            case '"': return '&quot;'
            default: return c
        }
    })
}

export async function GET() {
    try {
        const { env } = await getCacheContext()
        const reportService = new ReportService(env)
        const channels = await getChannels(env)

        const twoDaysAgo = new Date(Date.now() - TIME.daysToMs(2))
        const recentReports = []

        for (const channel of channels.slice(0, 5)) {
            const reports = await reportService.getAllReportsForChannel(channel.id)
            const recent = reports?.filter(r =>
                new Date(r.generatedAt) > twoDaysAgo
            ).slice(0, 20) || []

            recentReports.push(...recent.map(r => ({
                ...r,
                channelId: channel.id
            })))
        }

        const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recentReports.map(report => `  <url>
    <loc>https://news.fasttakeoff.org/current-events/${report.channelId}/${report.reportId}</loc>
    <news:news>
      <news:publication>
        <news:name>Fast Takeoff News</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${report.generatedAt}</news:publication_date>
      <news:title>${escapeXml(report.headline || 'Breaking News')}</news:title>
    </news:news>
  </url>`).join('\n')}
</urlset>`

        return new Response(sitemap, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=1800'
            }
        })
    } catch (error) {
        console.error('Error generating news sitemap:', error);
        return new Response('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
            headers: { 'Content-Type': 'application/xml' }
        })
    }
}
