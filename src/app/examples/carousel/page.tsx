import Link from 'next/link';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { getCacheContext } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carousel Examples - Fast Takeoff News',
};

// Force dynamic rendering since we need runtime environment
export const dynamic = 'force-dynamic';

export default async function Page() {
  const { env } = await getCacheContext();
  const factory = ServiceFactory.getInstance(env);
  const reportService = factory.createReportService();
  const reports = await reportService.getAllReports(8);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">IG Carousel Examples</h1>
      <p className="text-gray-600 mb-6">Pick a recent report to open the 4-slide preview.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r) => (
          <Link key={r.reportId} href={`/examples/carousel/${r.channelId}/${r.reportId}`} className="block border rounded p-4 hover:bg-gray-50">
            <div className="text-sm text-gray-500">{new Date(r.generatedAt).toLocaleString()}</div>
            <div className="mt-1 text-xs text-gray-500">{r.channelName} • {r.city}</div>
            <div className="mt-2 font-semibold line-clamp-2">{r.headline}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

