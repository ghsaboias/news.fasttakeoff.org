import HomeContent from "@/components/HomeContent";
import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { ReportGeneratorService } from "@/lib/data/report-generator-service";
import { getCacheContext, getStartDate } from "@/lib/utils";
import { Suspense } from "react";

export const dynamic = 'force-dynamic'

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
    const { env } = getCacheContext();

    // Fetch reports server-side
    const reportGeneratorService = new ReportGeneratorService(env);
    const reports = await reportGeneratorService.cacheService.getAllReportsFromCache(4);

    // Fetch executive orders server-side (top 3)
    const startDate = getStartDate(1);
    const { orders } = await fetchExecutiveOrders(1, startDate);
    const sortedOrders = [...orders].sort((a, b) => {
      const dateA = a.publication.publicationDate || a.date;
      const dateB = b.publication.publicationDate || b.date;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    const executiveOrders = sortedOrders.slice(0, 3);

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