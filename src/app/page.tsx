import HomeContent from "@/components/HomeContent"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { getStartDate, groupAndSortReports } from "@/lib/utils"
import { Suspense } from "react"

export const dynamic = 'force-dynamic'

async function getReports(): Promise<Report[]> {
  try {
    const response = await fetch(`${process.env.SERVER_API_URL || 'https://news.fasttakeoff.org'}/api/reports`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Homepage SSR'
      },
      cache: 'no-store'
    })
    if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`)
    const fetchedReports = await response.json() as Report[]
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