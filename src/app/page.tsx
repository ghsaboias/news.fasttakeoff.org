'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchExecutiveOrders, type ExecutiveOrder } from "@/lib/data/executive-orders"
import { formatDate, getStartDate } from "@/lib/utils"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function Home() {
  const [latestExecutiveOrders, setLatestExecutiveOrders] = useState<ExecutiveOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Function to load executive orders
  async function loadExecutiveOrders() {
    try {
      setLoading(true)
      // Get executive orders from the last year to ensure we have enough data
      const startDate = getStartDate(1)
      const { orders } = await fetchExecutiveOrders(1, startDate)

      // Sort orders by publication date (newest first)
      const sortedOrders = [...orders].sort((a, b) => {
        // Use publicationDate for sorting if available, fallback to date
        const dateA = a.publicationDate || a.date
        const dateB = b.publicationDate || b.date
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })

      // Get the 3 most recent executive orders
      setLatestExecutiveOrders(sortedOrders.slice(0, 3))
    } catch (error) {
      console.error('Error loading executive orders:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load executive orders on initial render
  useEffect(() => {
    loadExecutiveOrders()

    // Set up a refresh interval (every hour)
    const refreshInterval = setInterval(() => {
      loadExecutiveOrders()
    }, 60 * 60 * 1000) // 1 hour in milliseconds

    // Clean up the interval on component unmount
    return () => clearInterval(refreshInterval)
  }, [])

  return (
    <div className="flex flex-col gap-16 py-8 md:py-12">
      {/* Hero Section */}
      <section className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
            AI World News
          </h1>
          <p className="max-w-[700px] text-lg text-muted-foreground md:text-xl">
            Your trusted source for AI governance, policy updates, and the latest developments in artificial intelligence regulation.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/executive-orders">
                Explore Executive Orders
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/current-events">
                Latest News
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Latest Executive Orders Section */}
      <section className="container mx-auto px-4">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest Executive Orders</h2>
            <Link href="/executive-orders" className="text-sm font-medium hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {loading ? (
              // Loading state - show skeleton cards
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
                      {formatDate(order.publicationDate || order.date)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {order.summary && !order.summary.includes('undefined') && !order.summary.includes('NaN')
                        ? order.summary
                        : `Executive Order published on ${formatDate(order.publicationDate || order.date)}`
                      }
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

      {/* Coming Soon Section - Replacing the News Section */}
      <section className="container mx-auto px-4">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest News</h2>
            <span className="text-sm font-medium text-muted-foreground">Coming Soon</span>
          </div>
          <Card className="p-6 text-center">
            <CardTitle className="mb-4">News Section Coming Soon</CardTitle>
            <CardDescription className="max-w-[600px] mx-auto mb-6">
              We&apos;re working on bringing you the latest news and updates in AI governance and policy.
              Stay tuned for our upcoming news section featuring the most pressing developments in the AI world.
            </CardDescription>
            <Button asChild variant="outline">
              <Link href="/executive-orders">
                Explore Executive Orders Instead
              </Link>
            </Button>
          </Card>
        </div>
      </section>
    </div>
  )
}
