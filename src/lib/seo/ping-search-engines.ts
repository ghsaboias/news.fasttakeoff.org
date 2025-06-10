const INDEXNOW_KEY = 'a8b2c3d4e5f6';

export async function pingSearchEngines(newUrls: string[]): Promise<void> {
    try {
        // Google sitemap ping - lightweight approach
        const sitemapPing = fetch('https://www.google.com/ping?sitemap=https://news.fasttakeoff.org/sitemap.xml').catch(() => { });

        // IndexNow ping - real-time URL submission
        const indexNowPing = fetch('https://api.indexnow.org/indexnow', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'FastTakeoffNews/1.0'
            },
            body: JSON.stringify({
                host: 'news.fasttakeoff.org',
                key: INDEXNOW_KEY,
                keyLocation: `https://news.fasttakeoff.org/${INDEXNOW_KEY}.txt`,
                urlList: newUrls.slice(0, 10) // IndexNow limits to 10 URLs per request
            })
        }).catch(() => { });

        // Fire both pings concurrently, don't wait for response
        await Promise.allSettled([sitemapPing, indexNowPing]);

        console.log(`Pinged search engines for ${newUrls.length} URLs`);
    } catch (error) {
        console.error('Error pinging search engines:', error);
    }
} 