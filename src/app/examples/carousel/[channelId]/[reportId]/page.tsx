import { ServiceFactory } from '@/lib/services/ServiceFactory';
import CarouselPreview from '../../CarouselPreview';
import { getCacheContext } from '@/lib/utils';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Carousel Preview - Fast Takeoff News',
};

// Force dynamic rendering since we need runtime environment
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ channelId: string; reportId: string }>;
};

export default async function Page({ params }: Params) {
  const { channelId, reportId } = await params;
  const { env } = await getCacheContext();
  const factory = ServiceFactory.getInstance(env);
  const reportService = factory.createReportService();
  const { report } = await reportService.getReportAndMessages(channelId, reportId);

  if (!report) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Report not found</h1>
        <p className="mt-2 text-gray-600">Channel: {channelId} • Report: {reportId}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">IG Carousel Preview</h1>
      <CarouselPreview report={report} />
    </div>
  );
}
