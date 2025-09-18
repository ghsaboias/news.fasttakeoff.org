import HomeContent from "@/components/HomeContent";
import { CacheManager } from "@/lib/cache-utils";
import { ExecutiveSummaryService } from "@/lib/data/executive-summary-service";
import { ServiceFactory } from "@/lib/services/ServiceFactory";
import { ExecutiveOrder } from "@/lib/types/executive-orders";
import { ExecutiveSummary, Report } from "@/lib/types/reports";
import { getCacheContext } from "@/lib/utils";
import { Suspense } from "react";

// Fix for static generation issue: Force dynamic rendering while preserving SEO
export const dynamic = 'force-dynamic'; // Ensures server-side data fetching works
export const revalidate = 300; // 5 minutes ISR - maintains SEO while keeping data fresh

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

    const cacheManager = new CacheManager(env);

    const fetchStartTime = Date.now();

    // Fetch reports, executive orders, and executive summary server-side in parallel
    const [reports, executiveOrders, executiveSummary] = await Promise.all([
      // Fetch reports with simple KV cache
      (async () => {
        try {
          const reportStartTime = Date.now();

          // Try cache first
          const cachedReports = await cacheManager.get<Report[]>('REPORTS_CACHE', 'homepage:reports');
          if (cachedReports && cachedReports.length > 0) {
            console.log(`[HOMEPAGE] Cache hit: ${cachedReports.length} reports`);
            return cachedReports.slice(0, 4);
          }

          // Cache miss or empty cache: fetch from D1
          if (cachedReports) {
            console.log('[HOMEPAGE] Cache exists but empty, fetching from D1');
          } else {
            console.log('[HOMEPAGE] Cache miss, fetching from D1');
          }
          const factory = ServiceFactory.getInstance(env);
          const reportService = factory.createReportService();
          const allReports = await reportService.getAllReports(10); // Get 10 for cache

          // Cache the results for 2 minutes
          if (allReports.length > 0) {
            await cacheManager.put('REPORTS_CACHE', 'homepage:reports', allReports, 120);
            console.log(`[HOMEPAGE] Cached ${allReports.length} reports for 2 minutes`);
          }

          console.log(`[PERF] Reports fetch took ${Date.now() - reportStartTime}ms`);
          return allReports.slice(0, 4);
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

    console.log(`[PERF] Total homepage data fetch took ${Date.now() - startTime}ms`);

    return {
      reports: reports || [],
      executiveOrders: executiveOrders || [],
      executiveSummary: executiveSummary
    };
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