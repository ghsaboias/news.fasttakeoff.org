import { Metadata } from 'next';
import MessageVolumeChart from '@/components/MessageVolumeChart';

export const metadata: Metadata = {
  title: 'Analytics Charts - FastTakeoff News',
  description: 'Data visualization and analytics for news reporting activity',
};

export default function ChartsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Visualize news reporting activity and message volume across channels
        </p>
      </div>

      <div className="space-y-8">
        <MessageVolumeChart />
      </div>
    </div>
  );
}