'use client'

import ReportsCarousel from "@/components/current-events/Carousel"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchExecutiveOrders } from "@/lib/data/executive-orders"
import { ExecutiveOrder } from "@/lib/types/core"
import { formatDate, getStartDate } from "@/lib/utils"
import Link from "next/link"
import { useEffect, useState } from "react"

export const dynamic = 'force-dynamic';

export default function Home() {
  const [latestExecutiveOrders, setLatestExecutiveOrders] = useState<ExecutiveOrder[]>([])
  const [loadingEO, setLoadingEO] = useState(true)

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

  useEffect(() => {
    loadExecutiveOrders();
    const refreshInterval = setInterval(() => {
      loadExecutiveOrders();
    }, 60 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  return (
    <div className="flex flex-col gap-16 py-8 md:py-12">
      {/* Hero Section */}
      <section className="mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
            AI World News
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
            AI-powered news for everyone.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild variant="default" size="lg">
              <Link href="/current-events">Latest News</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/executive-orders">Explore Executive Orders</Link>
            </Button>
          </div>
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
              Array(3).fill(0).map((_, index) => (
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
              latestExecutiveOrders.map((order) => (
                <Card key={order.id}>
                  <CardHeader>
                    <CardTitle className="line-clamp-2">{order.title}</CardTitle>
                    <CardDescription>
                      {formatDate(order.publication.publicationDate || order.date)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {order.summary && !order.summary.includes('undefined') && !order.summary.includes('NaN')
                        ? order.summary
                        : `Executive Order published on ${formatDate(order.publication.publicationDate || order.date)}`}
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/executive-orders/${order.id}`}>Read more</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-8">
                <p className="text-muted-foreground">No executive orders found.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Latest News Carousel */}
      <section className="mx-auto px-4 w-[95%]">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest News</h2>
            <Link href="/current-events" className="text-sm font-medium hover:underline">
              View all news
            </Link>
          </div>
          <ReportsCarousel />
        </div>
      </section>
    </div>
  )
}