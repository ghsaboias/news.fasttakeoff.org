import HomeContent from "@/components/HomeContent";
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

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent
        initialReports={[]}
        initialExecutiveOrders={[]}
      />
    </Suspense>
  )
}