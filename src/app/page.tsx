import HomeContent from "@/components/HomeContent";
import { ReportGeneratorService } from "@/lib/data/report-generator-service";
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
    const { env } = getCacheContext();

    // Fetch reports server-side
    const reportGeneratorService = new ReportGeneratorService(env);
    const reports = await reportGeneratorService.cacheService.getAllReportsFromCache(4);

    return {
      reports: reports || []
    };
  } catch (error) {
    console.error('Error fetching server-side data:', error);
    return {
      reports: []
    };
  }
}

export default async function Home() {
  const { reports } = await getServerSideData();

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent
        initialReports={reports}
        initialExecutiveOrders={[]}
      />
    </Suspense>
  )
}