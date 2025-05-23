'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { getStartDate, groupAndSortReports } from "@/lib/utils"
import { Search } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
export const dynamic = 'force-dynamic';

export default function Home() {
  const [latestExecutiveOrders, setLatestExecutiveOrders] = useState<ExecutiveOrder[]>([])
  const [loadingEO, setLoadingEO] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Use the consolidated geolocation hook
  const { isUSBased } = useGeolocation({ assumeNonUSOnError: true });

  const loadExecutiveOrders = useCallback(async () => {
    if (!isUSBased) {
      console.log('Skipping Executive Order fetch: Non-US location detected.');
      setLoadingEO(false);
      setLatestExecutiveOrders([]);
      return;
    }
    console.log('US location detected, fetching Executive Orders...');
    try {
      setLoadingEO(true)
      const startDate = getStartDate(1)
      const { orders } = await fetchExecutiveOrders(1, startDate)
      const sortedOrders = [...orders].sort((a, b) => {
        const dateA = a.publication.publicationDate || a.date
        const dateB = b.publication.publicationDate || b.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setLatestExecutiveOrders(sortedOrders.slice(0, 3))
    } catch (error) {
      console.error('Error loading executive orders:', error)
      setLatestExecutiveOrders([]);
    } finally {
      setLoadingEO(false)
    }
  }, [isUSBased])

  async function loadReports() {
    try {
      setLoadingReports(true)
      const response = await fetch('/api/reports', {
        method: 'GET',
      })
      if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`)
      const fetchedReports = await response.json() as Report[]
      setReports(groupAndSortReports(fetchedReports))
    } catch (error) {
      console.error('[Carousel] Error fetching reports:', error)
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    loadReports();
    if (isUSBased === true) {
      loadExecutiveOrders();
    }
  }, [isUSBased, loadExecutiveOrders]);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) {
      return reports;
    }

    const query = searchQuery.toLowerCase();
    return reports.filter(report =>
      (report.channelName?.toLowerCase() || '').includes(query) ||
      (report.headline?.toLowerCase() || '').includes(query) ||
      (report.city?.toLowerCase() || '').includes(query) ||
      (report.body?.toLowerCase() || '').includes(query)
    );
  }, [reports, searchQuery]);

  return (
    <div className="flex flex-col pb-16 w-[100vw] justify-center">
      {/* Hero Section */}
      <section className="flex flex-col items-center justify-center min-[540px]:h-[36vh] gap-4 text-center max-[540px]:w-[90%] max-[540px]:mx-auto max-[540px]:mb-10 max-[540px]:mt-4">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-6xl md:text-7xl font-bold text-[#167F6E] leading-none flex flex-col sm:block">
              Fast Takeoff News
            </h1>
            <p className="text-3xl">AI-powered news for everyone.</p>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="mx-auto sm:px-4 w-[90%] mb-8">
        <div className="relative max-w-2xl mx-auto">
          <Search className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search all reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 text-lg"
          />
        </div>
      </section>

      <section className="mx-auto sm:px-4 w-[90%]">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {loadingReports ? (
            Array(4)
              .fill(0)
              .map((_, index) => (
                <Card key={index} className="animate-pulse">
                  <CardHeader>
                    <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-muted rounded w-1/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-4 bg-muted rounded w-full mb-2"></div>
                    <div className="h-4 bg-muted rounded w-full mb-2"></div>
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                  </CardContent>
                  <CardFooter>
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                  </CardFooter>
                </Card>
              ))
          ) : filteredReports.length > 0 ? (
            filteredReports.map(report => (
              <ReportCard key={report.reportId} report={report} showReadMore={false} clickableChannel={true} clickableReport={true} />
            )).slice(0, 4)
          ) : (
            <div className="col-span-2 text-center py-8">
              <p className="text-muted-foreground">
                {searchQuery ? "No reports found matching your search." : "No reports found."}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Executive Orders Section - RENDER CONDITIONALLY */}
      {isUSBased === true && (
        <section className="mx-auto sm:px-4 w-[90%] mt-16">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest Executive Orders</h2>
              <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                View all
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {loadingEO ? (
                Array(3)
                  .fill(0)
                  .map((_, index) => (
                    <Card key={index} className="animate-pulse">
                      <CardHeader>
                        <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                        <div className="h-4 bg-muted rounded w-1/4"></div>
                      </CardHeader>
                      <CardContent>
                        <div className="h-4 bg-muted rounded w-full mb-2"></div>
                        <div className="h-4 bg-muted rounded w-full mb-2"></div>
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                      </CardContent>
                      <CardFooter>
                        <div className="h-8 bg-muted rounded w-1/3"></div>
                      </CardFooter>
                    </Card>
                  ))
              ) : latestExecutiveOrders.length > 0 ? (
                latestExecutiveOrders.map(order => (
                  <OrderCard key={order.id} order={order} />
                ))
              ) : (
                <div className="col-span-3 text-center py-8">
                  <p className="text-muted-foreground">No executive orders found.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}