const INDEXNOW_KEY = 'a8b2c3d4e5f6';

export async function pingSearchEngines(newUrls: string[]): Promise<void> {
    try {
        console.log(`[PING] Starting search engine pings for ${newUrls.length} URLs`);
        
        const promises: Promise<Response | void>[] = [];

        // Google deprecated sitemap ping in June 2023, so we skip it
        // Google now discovers sitemap updates automatically via robots.txt and periodic crawling

        // Bing sitemap ping
        const bingSitemapPing = fetch('https://www.bing.com/ping?sitemap=https://news.fasttakeoff.org/sitemap-index.xml')
            .then(res => {
                console.log(`[PING] Bing sitemap ping status: ${res.status}`);
                return res;
            })
            .catch(err => {
                console.error('[PING] Bing sitemap ping failed:', err);
            });
        promises.push(bingSitemapPing);

        // IndexNow ping - batch URLs in groups of 10
        if (newUrls.length > 0) {
            const urlBatches = [];
            for (let i = 0; i < newUrls.length; i += 10) {
                urlBatches.push(newUrls.slice(i, i + 10));
            }

            for (const batch of urlBatches) {
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
                        urlList: batch
                    })
                })
                .then(res => {
                    console.log(`[PING] IndexNow batch (${batch.length} URLs) status: ${res.status}`);
                    return res;
                })
                .catch(err => {
                    console.error(`[PING] IndexNow batch failed:`, err);
                });
                
                promises.push(indexNowPing);
                
                // Small delay between batches to avoid rate limiting
                if (urlBatches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        }

        // Execute all pings concurrently
        const results = await Promise.allSettled(promises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`[PING] Completed: ${successful} successful, ${failed} failed pings for ${newUrls.length} URLs`);
    } catch (error) {
        console.error('[PING] Error in pingSearchEngines:', error);
    }
} 