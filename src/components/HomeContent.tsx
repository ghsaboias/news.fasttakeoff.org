'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import ExecutiveSummary from "@/components/ExecutiveSummary"
import ReportCardSkeleton from "@/components/skeletons/ReportCardSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, Report, ExecutiveSummary as ExecutiveSummaryType } from "@/lib/types/core"
import Link from "next/link"
import { useState } from "react"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
    initialExecutiveSummary: ExecutiveSummaryType | null
}

export default function HomeContent({ initialReports, initialExecutiveOrders, initialExecutiveSummary }: HomeContentProps) {
    const [reports] = useState<Report[]>(initialReports)
    const [executiveOrders] = useState<ExecutiveOrder[]>(initialExecutiveOrders)
    const [email, setEmail] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submitMessage, setSubmitMessage] = useState("")

    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ assumeNonUSOnError: true })

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!email.trim()) {
            setSubmitMessage("Please enter your email address")
            return
        }

        setIsSubmitting(true)
        setSubmitMessage("")

        try {
            const response = await fetch('/api/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: email.trim() }),
            })

            const data = await response.json()

            if (response.ok) {
                setSubmitMessage("Successfully subscribed! 🎉")
                setEmail("")
            } else {
                setSubmitMessage(data.error || "Failed to subscribe")
            }
        } catch (error) {
            console.error('Error submitting email:', error)
            setSubmitMessage("Something went wrong. Please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <div className="flex flex-col pb-8 justify-center">
            {/* Executive Summary Section - New prominent section */}
            <section>
                <ExecutiveSummary initialSummary={initialExecutiveSummary} />
            </section>

            {/* Hero Section - Redesigned with better visual hierarchy */}
            <section className="hero-section m-6 sm:m-8">
                <div className="flex flex-col items-center gap-8">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <h1 className="hero-title text-4xl md:text-6xl font-bold bg-gradient-to-r from-[#167F6E] to-[#0A5C52] bg-clip-text text-transparent">
                            Fast Takeoff News
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-600 max-w-2xl">
                            AI-powered news for everyone. Get the latest news from on-the-ground sources.
                        </p>
                    </div>
                    <form onSubmit={handleEmailSubmit} className="flex flex-col items-center gap-4 sm:w-1/2 w-[90%] max-w-md">
                        <div className="flex items-center gap-4 w-full">
                            <Input
                                type="email"
                                placeholder="Enter your email for daily updates"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                                required
                                className="bg-white border-gray-300 focus:border-[#167F6E] focus:ring-[#167F6E]"
                            />
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="bg-[#167F6E] hover:bg-[#0A5C52] text-white"
                            >
                                {isSubmitting ? "..." : "Subscribe"}
                            </Button>
                            {
                                submitMessage && (
                                    <p className={`text-sm h-5 ${submitMessage.includes('🎉') ? 'text-green-600' : 'text-red-600'}`}>
                                        {submitMessage}
                                    </p>
                                )
                            }
                        </div>
                    </form>
                </div>
            </section>

            {/* Navigation Cards - New section for better discoverability */}
            <section className="mb-6 mx-6 sm:mx-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Link href="/current-events" className="group">
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#167F6E]">Current Events</h3>
                            <p className="text-sm text-gray-600 mt-2">Real-time news from on-the-ground sources</p>
                        </div>
                    </Link>
                    <Link href="/news-globe" className="group">
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#167F6E]">News Globe</h3>
                            <p className="text-sm text-gray-600 mt-2">Interactive 3D visualization of global news</p>
                        </div>
                    </Link>
                    <Link href="/brazil" className="group">
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#167F6E]">Brazil</h3>
                            <p className="text-sm text-gray-600 mt-2">AI-curated Brazilian news summaries</p>
                        </div>
                    </Link>
                    <Link href="/power-network" className="group">
                        <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-[#167F6E]">Power Network</h3>
                            <p className="text-sm text-gray-600 mt-2">Explore influential people and companies</p>
                        </div>
                    </Link>
                </div>
            </section>

            {/* Reports Section - Enhanced with better layout */}
            <section className="mx-6 sm:mx-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Latest Reports</h2>
                    <Link href="/current-events" className="text-sm font-medium text-[#167F6E] hover:underline">
                        View all reports →
                    </Link>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {reports.length === 0 ? (
                        // Show skeletons while loading
                        Array.from({ length: 4 }).map((_, i) => (
                            <ReportCardSkeleton key={i} />
                        ))
                    ) : reports.length > 0 ? (
                        reports.slice(0, 4).map(report => (
                            <ReportCard
                                key={report.reportId}
                                report={report}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 text-center py-8">
                            <p className="text-muted-foreground">
                                No reports found.
                            </p>
                        </div>
                    )}
                </div>
            </section>

            {/* Latest Executive Orders Section - Enhanced */}
            {isUSBased === true && executiveOrders.length > 0 && (
                <section className="mx-auto sm:px-4 w-[90%] mt-16 min-h-[300px]">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-bold tracking-tight md:text-3xl text-gray-900">Latest Executive Orders</h2>
                            <Link href="/executive-orders" className="text-sm font-medium text-[#167F6E] hover:underline">
                                View all →
                            </Link>
                        </div>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
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
