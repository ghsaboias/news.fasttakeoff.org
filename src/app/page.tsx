'use client'

import ReportsCarousel from "@/components/current-events/Carousel"
import OrderCard from "@/components/executive-orders/OrderCard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { TimeframeKey } from "@/lib/config"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { getStartDate } from "@/lib/utils"
import Link from "next/link"
import { useEffect, useState } from "react"

export const dynamic = 'force-dynamic';

export default function Home() {
  const [latestExecutiveOrders, setLatestExecutiveOrders] = useState<ExecutiveOrder[]>([])
  const [loadingEO, setLoadingEO] = useState(true)
  const [reports, setReports] = useState<Report[]>([])
  const [filteredReports, setFilteredReports] = useState<Report[]>([])
  const [loadingReports, setLoadingReports] = useState(true)
  const [activeTimeframes, setActiveTimeframes] = useState<Set<TimeframeKey>>(new Set([]))

  async function loadExecutiveOrders() {
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
    } finally {
      setLoadingEO(false)
    }
  }

  async function loadReports() {
    try {
      setLoadingReports(true)
      const response = await fetch('/api/reports', {
        method: 'GET',
      })
      if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`)
      const fetchedReports = await response.json() as Report[]
      setReports(fetchedReports)
    } catch (error) {
      console.error('[Carousel] Error fetching reports:', error)
      setReports([])
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    setFilteredReports(
      activeTimeframes.size === 0
        ? reports
        : reports.filter(report =>
          report.timeframe && activeTimeframes.has(report.timeframe as TimeframeKey)
        )
    )
  }, [reports, activeTimeframes])

  useEffect(() => {
    loadExecutiveOrders()
    loadReports()
  }, [])

  function toggleTimeframeFilter(timeframe: TimeframeKey) {
    setActiveTimeframes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(timeframe)) {
        newSet.delete(timeframe)
      } else {
        newSet.add(timeframe)
      }
      return newSet
    })
  }

  const isTimeframeActive = (timeframe: TimeframeKey): boolean =>
    activeTimeframes.has(timeframe)

  return (
    <div className="flex flex-col py-16 gap-16">
      {/* Hero Section */}
      <section className="mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
            AI World News
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
            AI-powered news for everyone.
          </p>
        </div>
      </section>

      {/* Current Events Carousel */}
      <section className="mx-auto px-4 w-[95%]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Current Events</h2>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant={isTimeframeActive('2h') ? 'default' : 'outline'}
                onClick={() => toggleTimeframeFilter('2h')}
              >
                2h
              </Button>
              <Button
                size="icon"
                variant={isTimeframeActive('6h') ? 'default' : 'outline'}
                onClick={() => toggleTimeframeFilter('6h')}
              >
                6h
              </Button>
            </div>
          </div>
          <ReportsCarousel reports={filteredReports} loading={loadingReports} />
        </div>
      </section>

      {/* Latest Executive Orders Section */}
      <section className="mx-auto px-4 w-[95%]">
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
    </div>
  )
}