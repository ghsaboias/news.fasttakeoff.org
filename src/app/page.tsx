import HomeContent from "@/components/HomeContent"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

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