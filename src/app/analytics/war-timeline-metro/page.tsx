import WarTimelineMetro from '@/components/WarTimelineMetro'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Timeline - Metro Style | Fast Takeoff',
  description: 'Visual prototype: Metro/subway-style war timeline',
}

export default function WarTimelineMetroPage() {
  return <WarTimelineMetro />
}
