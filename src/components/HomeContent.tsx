'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import ExecutiveSummary from "@/components/ExecutiveSummary"
import ReportCardSkeleton from "@/components/skeletons/ReportCardSkeleton"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder } from "@/lib/types/executive-orders"
import { ExecutiveSummary as ExecutiveSummaryType } from "@/lib/types/reports"
import { Report } from "@/lib/types/reports"
import Link from "next/link"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
    initialExecutiveSummary: ExecutiveSummaryType | null
}

export default function HomeContent({ initialReports, initialExecutiveOrders, initialExecutiveSummary }: HomeContentProps) {
    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ assumeNonUSOnError: true })

    return (
        <div className="flex flex-col justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-black min-h-screen pt-8">

            {/* Executive Summary Section - New prominent section */}
            <section>
                <ExecutiveSummary initialSummary={initialExecutiveSummary} />
            </section>

            {/* Navigation Cards - Industrial dark theme */}
            <section className="mb-6 mx-6 sm:mx-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/current-events" className="group">
                        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 p-6 border border-gray-600/50 hover:border-emerald-500/50 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">Current Events</h3>
                            <p className="text-sm text-gray-200 mt-2">Real-time news from on-the-ground sources</p>
                        </div>
                    </Link>
                    <Link href="/news-globe" className="group">
                        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 p-6 border border-gray-600/50 hover:border-emerald-500/50 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">News Globe</h3>
                            <p className="text-sm text-gray-200 mt-2">Interactive 3D visualization of global news</p>
                        </div>
                    </Link>
                    <Link href="/brazil" className="group">
                        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 p-6 border border-gray-600/50 hover:border-emerald-500/50 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">Brazil</h3>
                            <p className="text-sm text-gray-200 mt-2">AI-curated Brazilian news summaries</p>
                        </div>
                    </Link>
                    <Link href="/power-network" className="group">
                        <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-lg shadow-xl hover:shadow-2xl transition-all duration-300 p-6 border border-gray-600/50 hover:border-emerald-500/50 backdrop-blur-sm">
                            <h3 className="text-lg font-semibold text-gray-100 group-hover:text-emerald-400 transition-colors">Power Network</h3>
                            <p className="text-sm text-gray-200 mt-2">Explore influential people and companies</p>
                        </div>
                    </Link>
                </div>
            </section>

            {/* Reports Section */}
            <section className="mx-6 sm:mx-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-100">Latest Reports</h2>
                    <Link href="/current-events" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline">
                        View all reports →
                    </Link>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {initialReports.length === 0 ? (
                        // Show skeletons while loading
                        Array.from({ length: 4 }).map((_, i) => (
                            <ReportCardSkeleton key={i} />
                        ))
                    ) : (
                        initialReports.slice(0, 4).map(report => (
                            <ReportCard
                                key={report.reportId}
                                report={report}
                            />
                        ))
                    )}
                </div>
            </section>

            {/* Latest Executive Orders Section - Enhanced with industrial theme */}
            {isUSBased === true && initialExecutiveOrders.length > 0 && (
                <section className="mx-auto sm:px-4 w-[90%] mt-16 min-h-[300px]">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold tracking-tight md:text-3xl text-gray-100">Latest Executive Orders</h2>
                            <Link href="/executive-orders" className="text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:underline">
                                View all →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                            {initialExecutiveOrders.map(order => (
                                <OrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
    )
}
