'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import ReportCardSkeleton from "@/components/skeletons/ReportCardSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, Report } from "@/lib/types/core"
import Link from "next/link"
import { useState } from "react"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
}

export default function HomeContent({ initialReports, initialExecutiveOrders }: HomeContentProps) {
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
        <div className="flex flex-col pb-8 w-[100vw] justify-center">
            {/* Reports Section - Fixed height grid */}
            <section className="mx-auto sm:px-4 w-[95%] min-h-[800px] sm:min-h-[600px]">
                <h2 className="sr-only">Latest Reports</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-8">
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
                    <form onSubmit={handleEmailSubmit} className="flex flex-col items-center gap-4 sm:w-1/2 w-[90%]">
                        <div className="flex items-center gap-4 w-full">
                            <Input
                                type="email"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                                required
                            />
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "..." : "Subscribe"}
                            </Button>
                        </div>

                        <p className={`text-sm h-5 ${submitMessage.includes('🎉') ? 'text-green-600' : 'text-red-600'}`}>
                            {submitMessage}
                        </p>
                    </form>
                </section>
            </div>

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