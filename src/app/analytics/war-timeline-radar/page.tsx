import WarTimelineRadar from '@/components/WarTimelineRadar'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Timeline - Tactical Radar | Fast Takeoff',
  description: 'Visual prototype: Tactical radar-style war timeline',
}

export default function WarTimelineRadarPage() {
  return <WarTimelineRadar />
}
