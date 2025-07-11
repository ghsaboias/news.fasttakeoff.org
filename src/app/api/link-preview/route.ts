import { withErrorHandling } from '@/lib/api-utils';
import { CacheManager } from '@/lib/cache-utils';

interface LinkPreview {
    url: string;
    title?: string;
    description?: string;
    image?: string;
    siteName?: string;
    domain: string;
    cachedAt: string;
}

// Extract domain from URL for fallback display
function extractDomain(url: string): string {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch {
        return url;
    }
}

// Parse HTML to extract Open Graph and meta tags
function parseMetaTags(html: string, url: string): LinkPreview {
    const domain = extractDomain(url);

    // Extract title
    const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"[^>]*>/i) ||
        html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract description
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"[^>]*>/i) ||
        html.match(/<meta\s+name="description"\s+content="([^"]*)"[^>]*>/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Extract image
    const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"[^>]*>/i);
    let image = imageMatch ? imageMatch[1].trim() : undefined;

    // Make relative URLs absolute
    if (image && !image.startsWith('http')) {
        try {
            const baseUrl = new URL(url);
            image = new URL(image, baseUrl.origin).href;
        } catch {
            image = undefined;
        }
    }

    // Extract site name
    const siteNameMatch = html.match(/<meta\s+property="og:site_name"\s+content="([^"]*)"[^>]*>/i);
    const siteName = siteNameMatch ? siteNameMatch[1].trim() : domain;

    return {
        url,
        title,
        description,
        image,
        siteName,
        domain,
        cachedAt: new Date().toISOString()
    };
}

export async function GET(request: Request) {
    return withErrorHandling(async env => {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');

        if (!url) {
            throw new Error('Missing url parameter');
        }

        // Validate URL
        try {
            new URL(url);
        } catch {
            throw new Error('Invalid URL');
        }

        const cacheManager = new CacheManager(env);
        const cacheKey = `link_preview:${url}`;

        // Check cache first (24 hour TTL)
        const cached = await cacheManager.get<LinkPreview>('MESSAGES_CACHE', cacheKey);
        if (cached) {
            return cached;
        }

        try {
            // Fetch the URL with a reasonable timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; FastTakeoff-LinkPreview/1.0)',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1',
                },
                signal: controller.signal,
                redirect: 'follow'
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
                throw new Error('Not an HTML page');
            }

            const html = await response.text();
            const preview = parseMetaTags(html, url);

            // Cache the result for 24 hours
            await cacheManager.put('MESSAGES_CACHE', cacheKey, preview, 24 * 60 * 60);

            return preview;

        } catch (error) {
            console.error(`Error fetching link preview for ${url}:`, error);

            // Return minimal preview on error
            const fallbackPreview: LinkPreview = {
                url,
                domain: extractDomain(url),
                cachedAt: new Date().toISOString()
            };

            // Cache the fallback for 1 hour to avoid repeated failures
            await cacheManager.put('MESSAGES_CACHE', cacheKey, fallbackPreview, 60 * 60);

            return fallbackPreview;
        }
    }, 'Failed to fetch link preview');
} 