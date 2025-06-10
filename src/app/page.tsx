import HomeContent from "@/components/HomeContent";
import { ReportGeneratorService } from "@/lib/data/report-generator-service";
import { ExecutiveOrder } from "@/lib/types/core";
import { getCacheContext } from "@/lib/utils";
import { Suspense } from "react";

export const revalidate = 300; // 5 minutes

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
  try {
    const { env } = await getCacheContext();

    // Check if we have a valid Cloudflare environment
    if (!env || !env.REPORTS_CACHE || !env.EXECUTIVE_ORDERS_CACHE) {
      console.log('[SERVER] Cloudflare environment not available, skipping server-side data fetch');
      return {
        reports: [],
        executiveOrders: []
      };
    }

    // Fetch both reports and executive orders server-side in parallel
    const [reports, executiveOrders] = await Promise.all([
      // Fetch reports
      (async () => {
        try {
          const reportGeneratorService = new ReportGeneratorService(env);
          return await reportGeneratorService.cacheService.getAllReportsFromCache(4);
        } catch (error) {
          console.error('Error fetching reports server-side:', error);
          return [];
        }
      })(),
      // Fetch executive orders
      (async (): Promise<ExecutiveOrder[]> => {
        try {
          const cached = await env.EXECUTIVE_ORDERS_CACHE.get('latest', { type: 'json' });
          return (cached as ExecutiveOrder[]) || [];
        } catch (error) {
          console.error('Error fetching executive orders server-side:', error);
          return [];
        }
      })()
    ]);

    return {
      reports: reports || [],
      executiveOrders: executiveOrders || []
    };
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