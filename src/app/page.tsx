import HomeContent from "@/components/HomeContent";
import { CacheManager } from "@/lib/cache-utils";
import { ReportGeneratorService } from "@/lib/data/report-generator-service";
import { ExecutiveOrder, Report } from "@/lib/types/core";
import { getCacheContext } from "@/lib/utils";
import { Suspense } from "react";

// Aggressive caching for breaking news - balance freshness vs performance
export const revalidate = 180; // 3 minutes

export async function generateMetadata() {
  return {
    title: 'Fast Takeoff News',
    description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
    alternates: {
      canonical: 'https://news.fasttakeoff.org'
    }
  };
}

async function getServerSideData() {
  const startTime = Date.now();

  // Clear request-level cache at the start of each request
  CacheManager.clearRequestCache();

  try {
    const { env } = await getCacheContext();
    console.log(`[PERF] getCacheContext took ${Date.now() - startTime}ms`);

    // Check if we have a valid Cloudflare environment
    if (!env || !env.REPORTS_CACHE || !env.EXECUTIVE_ORDERS_CACHE) {
      console.log('[SERVER] Cloudflare environment not available, skipping server-side data fetch');
      return {
        reports: [],
        executiveOrders: []
      };
    }

    // Add response-level caching check
    const cacheKey = 'homepage:full-response';
    const cachedResponse = await env.REPORTS_CACHE.get(cacheKey, { type: 'json' });

    if (cachedResponse) {
      console.log(`[PERF] Using cached homepage response (${Date.now() - startTime}ms)`);
      return cachedResponse as { reports: Report[], executiveOrders: ExecutiveOrder[] };
    }

    const fetchStartTime = Date.now();

    // Fetch both reports and executive orders server-side in parallel
    const [reports, executiveOrders] = await Promise.all([
      // Fetch reports with timeout
      (async () => {
        try {
          const reportStartTime = Date.now();
          const reportGeneratorService = new ReportGeneratorService(env);
          const result = await reportGeneratorService.cacheService.getAllReportsFromCache(4);
          console.log(`[PERF] Reports fetch took ${Date.now() - reportStartTime}ms`);
          return result;
        } catch (error) {
          console.error('Error fetching reports server-side:', error);
          return [];
        }
      })(),
      // Fetch executive orders with timeout
      (async (): Promise<ExecutiveOrder[]> => {
        try {
          const eoStartTime = Date.now();
          const cached = await env.EXECUTIVE_ORDERS_CACHE.get('latest', { type: 'json' });
          console.log(`[PERF] Executive orders fetch took ${Date.now() - eoStartTime}ms`);
          return (cached as ExecutiveOrder[]) || [];
        } catch (error) {
          console.error('Error fetching executive orders server-side:', error);
          return [];
        }
      })()
    ]);

    console.log(`[PERF] Parallel fetch took ${Date.now() - fetchStartTime}ms`);

    const response = {
      reports: reports || [],
      executiveOrders: executiveOrders || []
    };

    // Cache the full response for 2 minutes
    await env.REPORTS_CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 120 });
    console.log(`[PERF] Total homepage data fetch took ${Date.now() - startTime}ms`);

    return response;
  } catch (error) {
    console.error('Error fetching server-side data:', error);
    return {
      reports: [],
      executiveOrders: []
    };
  }
}

export default async function Home() {
  const { reports, executiveOrders } = await getServerSideData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent
        initialReports={reports}
        initialExecutiveOrders={executiveOrders}
      />
    </Suspense>
  )
}