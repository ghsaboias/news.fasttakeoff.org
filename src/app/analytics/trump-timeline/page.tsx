import TrumpTimeline from '@/components/TrumpTimeline'

export const dynamic = 'force-dynamic'

export default function TrumpTimelinePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <TrumpTimeline />
    </div>
  )
}