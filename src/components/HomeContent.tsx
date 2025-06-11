'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import ReportCardSkeleton from "@/components/skeletons/ReportCardSkeleton"
import { Input } from "@/components/ui/input"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import { Search } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
}

export default function HomeContent({ initialReports, initialExecutiveOrders }: HomeContentProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [reports] = useState<Report[]>(initialReports)
    const [executiveOrders] = useState<ExecutiveOrder[]>(initialExecutiveOrders)

    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ assumeNonUSOnError: true })

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
        <div className="flex flex-col pb-8 w-[100vw] justify-center">
            <div className="my-8">
                {/* Hero Section - Fixed height to prevent layout shift */}
                <section className="hero-section m-4 sm:m-8">
                    <div className="flex flex-col items-center gap-8">
                        <div className="flex flex-col items-center gap-4">
                            <h1 className="hero-title">
                                Fast Takeoff News
                            </h1>
                            <p className="text-3xl">AI-powered news for everyone.</p>
                        </div>
                    </div>
                </section>

                {/* Search Section - Fixed height */}
                <section className="mx-auto mx-6 mt-6 w-[90%] sm:w-full h-[48px]">
                    <h2 className="sr-only">Search Reports</h2>
                    <div className="relative max-w-2xl mx-auto">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 card-text" />
                        <Input
                            placeholder="Search all reports..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-10 text-lg"
                        />
                    </div>
                </section>
            </div>

            {/* Reports Section - Fixed height grid */}
            <section className="mx-auto sm:px-4 w-[95%] min-h-[800px] sm:min-h-[600px]">
                <h2 className="sr-only">Latest Reports</h2>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {reports.length === 0 ? (
                        // Show skeletons while loading
                        Array.from({ length: 4 }).map((_, i) => (
                            <ReportCardSkeleton key={i} />
                        ))
                    ) : filteredReports.length > 0 ? (
                        filteredReports.slice(0, 4).map(report => (
                            <ReportCard
                                key={report.reportId}
                                report={report}
                                showReadMore={false}
                                clickableChannel={true}
                                clickableReport={true}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 text-center py-8">
                            <p className="text-muted-foreground">
                                {searchQuery ? "No reports found matching your search." : "No reports found."}
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Latest Executive Orders Section - Fixed height when visible */}
            {isUSBased === true && executiveOrders.length > 0 && (
                <section className="mx-auto sm:px-4 w-[90%] mt-16 min-h-[300px]">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Latest Executive Orders</h2>
                            <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {executiveOrders.map(order => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
} 