// Screenshot generation service for social media images

// Worker URLs
const SVG_GENERATOR_URL = 'https://svg-generator.gsaboia.workers.dev';
const BROWSER_WORKER_URL = 'https://browser-worker.gsaboia.workers.dev';

export class ScreenshotService {
    /**
     * Generates a screenshot URL for a given headline
     * This triggers the browser-worker to generate and cache the screenshot
     */
    static async generateScreenshotUrl(headline: string): Promise<string> {
        const svgUrl = `${SVG_GENERATOR_URL}/?headline=${encodeURIComponent(headline)}`;
        const screenshotUrl = `${BROWSER_WORKER_URL}/?url=${encodeURIComponent(svgUrl)}`;
        
        console.log(`[SCREENSHOT] Generating screenshot for headline: "${headline}"`);
        console.log(`[SCREENSHOT] SVG URL: ${svgUrl}`);
        console.log(`[SCREENSHOT] Screenshot URL: ${screenshotUrl}`);
        
        try {
            // Pre-generate the screenshot to warm the cache
            console.log(`[SCREENSHOT] Pre-generating screenshot...`);
            const preGenStart = Date.now();
            
            const preGenResponse = await fetch(screenshotUrl, {
                signal: AbortSignal.timeout(60000) // 60 second timeout
            });
            
            const preGenTime = Date.now() - preGenStart;
            console.log(`[SCREENSHOT] Pre-generation completed in ${preGenTime}ms, status: ${preGenResponse.status}`);
            
            if (!preGenResponse.ok) {
                const errorBody = await preGenResponse.text();
                console.error(`[SCREENSHOT] Pre-generation failed: ${preGenResponse.status} - ${errorBody}`);
                // Return the URL anyway - it might work when Instagram fetches it
                console.log(`[SCREENSHOT] Returning URL despite pre-generation failure`);
                return screenshotUrl;
            }
            
            const contentType = preGenResponse.headers.get('content-type');
            const contentLength = preGenResponse.headers.get('content-length');
            console.log(`[SCREENSHOT] Screenshot successfully pre-generated - Content-Type: ${contentType}, Content-Length: ${contentLength}`);
            
            return screenshotUrl;
            
        } catch (error) {
            console.error(`[SCREENSHOT] Error during pre-generation:`, error);
            // Return the URL anyway - it might work when Instagram fetches it
            console.log(`[SCREENSHOT] Returning URL despite error, Instagram can try later`);
            return screenshotUrl;
        }
    }
    
    /**
     * Validates if a screenshot URL is accessible
     */
    static async validateScreenshotUrl(screenshotUrl: string): Promise<boolean> {
        try {
            const response = await fetch(screenshotUrl, { 
                method: 'HEAD',
                signal: AbortSignal.timeout(10000) // 10 second timeout for validation
            });
            return response.ok;
        } catch (error) {
            console.error(`[SCREENSHOT] Validation failed for URL: ${screenshotUrl}`, error);
            return false;
        }
    }
}