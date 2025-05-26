import HomeContent from "@/components/HomeContent"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { ReportsService } from "@/lib/data/reports-service"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { getCacheContext, getStartDate, groupAndSortReports } from "@/lib/utils"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

async function getReports(): Promise<Report[]> {
  try {
    const { env } = getCacheContext()
    const reportsService = new ReportsService(env)
    const fetchedReports = await reportsService.getAllReportsFromCache()
    return groupAndSortReports(fetchedReports)
  } catch (error) {
    console.error('Error fetching reports for homepage:', error)
    return []
  }
}

async function getExecutiveOrders(): Promise<ExecutiveOrder[]> {
  try {
    const startDate = getStartDate(1)
    const { orders } = await fetchExecutiveOrders(1, startDate)
    const sortedOrders = [...orders].sort((a, b) => {
      const dateA = a.publication.publicationDate || a.date
      const dateB = b.publication.publicationDate || b.date
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
    return sortedOrders.slice(0, 3)
  } catch (error) {
    console.error('Error loading executive orders for homepage:', error)
    return []
  }
}

export default async function Home() {
  // Fetch data server-side
  const [reports, executiveOrders] = await Promise.all([
    getReports(),
    getExecutiveOrders()
  ])

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent
        initialReports={reports}
        initialExecutiveOrders={executiveOrders}
      />
    </Suspense>
  )
}