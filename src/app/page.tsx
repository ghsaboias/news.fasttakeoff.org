import HomeContent from "@/components/HomeContent";
import { CacheManager } from "@/lib/cache-utils";
import { ExecutiveSummaryService } from "@/lib/data/executive-summary-service";
import { ReportService } from "@/lib/data/report-service";
import { ExecutiveOrder, ExecutiveSummary, Report } from "@/lib/types/core";
import { getCacheContext } from "@/lib/utils";
import { Suspense } from "react";

// Aggressive caching for breaking news - balance freshness vs performance
export const revalidate = 180; // 3 minutes
export const dynamic = 'force-dynamic';

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
        executiveOrders: [],
        executiveSummary: null
      };
    }

    // Add response-level caching check
    const cacheManager = new CacheManager(env);
    const cacheKey = 'homepage:full-response';
    const cachedResponse = await cacheManager.get<{ reports: Report[], executiveOrders: ExecutiveOrder[], executiveSummary: ExecutiveSummary | null }>('REPORTS_CACHE', cacheKey);

    if (cachedResponse) {
      console.log(`[PERF] Using cached homepage response (${Date.now() - startTime}ms)`);
      return cachedResponse;
    }

    const fetchStartTime = Date.now();

    // Fetch reports, executive orders, and executive summary server-side in parallel
    const [reports, executiveOrders, executiveSummary] = await Promise.all([
      // Fetch reports with timeout
      (async () => {
        try {
          const reportStartTime = Date.now();
          const reportService = new ReportService(env);
          const result = await reportService.getAllReports(4);
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
          const cached = await cacheManager.get<ExecutiveOrder[]>('EXECUTIVE_ORDERS_CACHE', 'latest');
          console.log(`[PERF] Executive orders fetch took ${Date.now() - eoStartTime}ms`);
          return cached || [];
        } catch (error) {
          console.error('Error fetching executive orders server-side:', error);
          return [];
        }
      })(),
      // Fetch executive summary with timeout
      (async (): Promise<ExecutiveSummary | null> => {
        try {
          const summaryStartTime = Date.now();
          const executiveSummaryService = new ExecutiveSummaryService(env);
          const result = await executiveSummaryService.getLatestSummary();
          console.log(`[PERF] Executive summary fetch took ${Date.now() - summaryStartTime}ms`);
          return result;
        } catch (error) {
          console.error('Error fetching executive summary server-side:', error);
          return null;
        }
      })()
    ]);

    console.log(`[PERF] Parallel fetch took ${Date.now() - fetchStartTime}ms`);

    const response = {
      reports: reports || [],
      executiveOrders: executiveOrders || [],
      executiveSummary: executiveSummary
    };

    // Cache the full response for 2 minutes
    await cacheManager.put('REPORTS_CACHE', cacheKey, response, 120);
    console.log(`[PERF] Total homepage data fetch took ${Date.now() - startTime}ms`);

    return response;
  } catch (error) {
    console.error('Error fetching server-side data:', error);
    return {
      reports: [],
      executiveOrders: [],
      executiveSummary: null
    };
  }
}

export default async function Home() {
  const { reports, executiveOrders, executiveSummary } = await getServerSideData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent
        initialReports={reports}
        initialExecutiveOrders={executiveOrders}
        initialExecutiveSummary={executiveSummary}
      />
    </Suspense>
  )
}