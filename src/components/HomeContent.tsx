'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { groupAndSortReports } from "@/lib/utils"
import { Search } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
}

// Skeleton component for ReportCard
function ReportCardSkeleton() {
    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4 animate-pulse">
            <CardHeader>
                <div className="flex justify-between gap-2 mb-1 items-center">
                    <div className="flex flex-row gap-2 items-center">
                        <div className="bg-muted rounded h-5 w-20"></div>
                    </div>
                    <div className="bg-muted rounded h-3 w-16"></div>
                </div>
                <div className="bg-muted rounded h-6 w-3/4 mb-2"></div>
                <div className="bg-muted rounded h-4 w-1/2"></div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <div className="text-sm flex-grow h-16 space-y-2">
                    <div className="bg-muted rounded h-4 w-full"></div>
                    <div className="bg-muted rounded h-4 w-full"></div>
                    <div className="bg-muted rounded h-4 w-3/4"></div>
                    <div className="bg-muted rounded h-4 w-full"></div>
                    <div className="bg-muted rounded h-4 w-2/3"></div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                <div className="bg-muted rounded h-8 w-full"></div>
                <div className="flex flex-row gap-1 justify-between w-full items-center">
                    <div className="bg-muted rounded h-5 w-12"></div>
                    <div className="bg-muted rounded h-6 w-16"></div>
                </div>
            </CardFooter>
        </Card>
    )
}

// Skeleton component for OrderCard
function OrderCardSkeleton() {
    return (
        <Card className="gap-4 animate-pulse">
            <CardHeader>
                <div className="bg-muted rounded h-6 w-full mb-2"></div>
                <div className="bg-muted rounded h-6 w-3/4 mb-2"></div>
                <div className="bg-muted rounded h-4 w-1/2"></div>
            </CardHeader>
            <CardFooter>
                <div className="bg-muted rounded h-8 w-full"></div>
            </CardFooter>
        </Card>
    )
}

export default function HomeContent({ initialReports, initialExecutiveOrders }: HomeContentProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [reports, setReports] = useState<Report[]>(initialReports)
    const [executiveOrders, setExecutiveOrders] = useState<ExecutiveOrder[]>(initialExecutiveOrders)
    const [reportsLoading, setReportsLoading] = useState(true)
    const [executiveOrdersLoading, setExecutiveOrdersLoading] = useState(true)

    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ assumeNonUSOnError: true })

    // Fetch reports on mount
    useEffect(() => {
        // Skip fetching if we already have initial data from server
        if (initialReports.length > 0) {
            setReports(initialReports)
            setReportsLoading(false)
            return
        }

        async function fetchReports() {
            try {
                const response = await fetch('/api/reports')
                if (!response.ok) throw new Error('Failed to fetch reports')
                const data = await response.json()
                const sortedReports = groupAndSortReports(data)
                setReports(sortedReports)
            } catch (error) {
                console.error('Error fetching reports:', error)
                setReports([])
            } finally {
                setReportsLoading(false)
            }
        }

        fetchReports()
    }, [initialReports])

    // Fetch executive orders on mount (only if US-based)
    useEffect(() => {
        // Skip fetching if we already have initial data from server
        if (initialExecutiveOrders.length > 0) {
            setExecutiveOrders(initialExecutiveOrders)
            setExecutiveOrdersLoading(false)
            return
        }

        async function fetchExecutiveOrders() {
            try {
                const response = await fetch('/api/executive-orders')
                if (!response.ok) throw new Error('Failed to fetch executive orders')
                const data = await response.json()
                setExecutiveOrders(data)
            } catch (error) {
                console.error('Error fetching executive orders:', error)
                setExecutiveOrders([])
            } finally {
                setExecutiveOrdersLoading(false)
            }
        }

        if (isUSBased === true) {
            fetchExecutiveOrders()
        } else if (isUSBased === false) {
            setExecutiveOrdersLoading(false)
        }
    }, [isUSBased, initialExecutiveOrders])

    const filteredReports = useMemo(() => {
        if (!searchQuery.trim()) {
            return reports
        }

        const query = searchQuery.toLowerCase()
        return reports.filter(report =>
            (report.channelName?.toLowerCase() || '').includes(query) ||
            (report.headline?.toLowerCase() || '').includes(query) ||
            (report.city?.toLowerCase() || '').includes(query) ||
            (report.body?.toLowerCase() || '').includes(query)
        )
    }, [reports, searchQuery])

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

            {/* Reports Section */}
            <section className="mx-auto sm:px-4 w-[90%]">
                {reportsLoading ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {[...Array(4)].map((_, i) => (
                            <ReportCardSkeleton key={i} />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        {filteredReports.length > 0 ? (
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
                )}
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
                        {executiveOrdersLoading ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {[...Array(3)].map((_, i) => (
                                    <OrderCardSkeleton key={i} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {executiveOrders.map(order => (
                                    <OrderCard key={order.id} order={order} />
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}
        </div>
    )
} 