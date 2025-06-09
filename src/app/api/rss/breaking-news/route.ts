import { TIME, TimeframeKey } from '@/lib/config'
import { getChannels } from '@/lib/data/channels-service'
import { ReportGeneratorService } from '@/lib/data/report-generator-service'
import { getCacheContext } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const { env } = getCacheContext()
    const reportGeneratorService = new ReportGeneratorService(env)
    const channels = await getChannels(env)

    // Get recent reports from all channels
    const allReports = []
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const timeframes: TimeframeKey[] = [...TIME.TIMEFRAMES] // Get all configured timeframes

    for (const channel of channels) {
      try {
        // Fetch reports for each timeframe
        for (const timeframe of timeframes) {
          const reports = await reportGeneratorService.cacheService.getReportsFromCache(channel.id, timeframe)
          if (reports) {
            const recentReports = reports
              .filter(report => new Date(report.generatedAt) >= oneDayAgo)
              .map(report => ({ ...report, channelName: channel.name }))
            allReports.push(...recentReports)
          }
        }
      } catch (error) {
        console.error(`Error fetching reports for channel ${channel.id}:`, error)
      }
    }

    // Sort by newest first and deduplicate by reportId
    const uniqueReports = Array.from(
      allReports.reduce((map, report) => {
        if (!map.has(report.reportId)) {
          map.set(report.reportId, report)
        }
        return map
      }, new Map()).values()
    )

    // Sort by newest first
    uniqueReports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())

    // Take top 50 for feed
    const feedReports = uniqueReports.slice(0, 50)

    const baseUrl = 'https://news.fasttakeoff.org'
    const buildDate = new Date().toUTCString()

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Fast Takeoff News - Breaking News</title>
    <link>${baseUrl}</link>
    <description>Real-time breaking news analysis and emerging story coverage. Updated every 2 hours.</description>
    <language>en-us</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${buildDate}</pubDate>
    <managingEditor>news@fasttakeoff.org (Fast Takeoff News)</managingEditor>
    <webMaster>admin@fasttakeoff.org (Fast Takeoff News)</webMaster>
    <category>News</category>
    <ttl>120</ttl>
    <atom:link href="${baseUrl}/api/rss/breaking-news" rel="self" type="application/rss+xml" />
    
${feedReports.map(report => {
      const pubDate = new Date(report.generatedAt).toUTCString()
      const headline = report.headline || `Breaking: ${report.channelName} Report`
      const description = report.body.substring(0, 300) + '...'
      const link = `${baseUrl}/current-events/${report.channelId}/${report.reportId}`

      return `    <item>
      <title><![CDATA[${headline}]]></title>
      <link>${link}</link>
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${report.body.replace(/\n\n/g, '</p><p>').replace(/^/, '<p>').replace(/$/, '</p>')}]]></content:encoded>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="true">${link}</guid>
      <category>Breaking News</category>
      ${report.city ? `<category>${report.city}</category>` : ''}
      <source url="${baseUrl}">${report.channelName}</source>
    </item>`
    }).join('\n')}
  </channel>
</rss>`

    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800', // Cache for 30 minutes
      },
    })
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    return new NextResponse('Error generating RSS feed', { status: 500 })
  }
}
