import WarTimelineBubble from '@/components/WarTimelineBubble'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Timeline - Bubble Style | Fast Takeoff',
  description: 'Visual prototype: Bubble-style war timeline',
}

export default function WarTimelineBubblePage() {
  return <WarTimelineBubble />
}
