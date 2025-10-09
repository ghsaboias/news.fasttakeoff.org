import WarTimelineSonar from '@/components/WarTimelineSonar'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'War Timeline - Sonar | Fast Takeoff',
  description: 'Visual prototype: Sonar/detection-style war timeline',
}

export default function WarTimelineSonarPage() {
  return <WarTimelineSonar />
}
