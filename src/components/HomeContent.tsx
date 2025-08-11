'use client'

import ReportCard from "@/components/current-events/ReportCard"
import OrderCard from "@/components/executive-orders/OrderCard"
import ExecutiveSummary from "@/components/ExecutiveSummary"
import ReportCardSkeleton from "@/components/skeletons/ReportCardSkeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useGeolocation } from "@/lib/hooks/useGeolocation"
import { ExecutiveOrder, ExecutiveSummary as ExecutiveSummaryType, Report } from "@/lib/types/core"
import Link from "next/link"
import { useState } from "react"

interface HomeContentProps {
    initialReports: Report[]
    initialExecutiveOrders: ExecutiveOrder[]
    initialExecutiveSummary: ExecutiveSummaryType | null
}

export default function HomeContent({ initialReports, initialExecutiveOrders, initialExecutiveSummary }: HomeContentProps) {
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
        <div className="flex flex-col justify-center bg-gradient-to-b from-gray-950 via-gray-900 to-black min-h-screen">
            {/* Hero Section - Industrial dark theme */}
            <section className="hero-section bg-gradient-to-br from-gray-950 via-gray-900 to-black backdrop-blur-lg mx-2 sm:mx-4 my-2 sm:my-4 min-h-[calc(100vh-4rem-1rem)] sm:min-h-[calc(100vh-4rem-2rem)] flex items-center rounded-2xl border border-gray-700/50 shadow-2xl shadow-black/60 relative overflow-hidden">
                {/* Industrial texture overlay */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_50%)] opacity-60"></div>
                <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_49%,rgba(255,255,255,0.01)_50%,transparent_51%)] bg-[length:20px_20px] opacity-30"></div>

                <div className="flex flex-col items-center gap-4 sm:gap-6 py-8 sm:py-12 px-6 w-full relative z-10">
                    {/* Social Proof Badge - Industrial styling */}
                    <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 text-emerald-300 border border-emerald-500/40 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-sm shadow-lg shadow-emerald-500/10">
                        ⚡ Real-time AI analysis from global sources
                    </div>

                    {/* Headlines & Value Props - Industrial color scheme */}
                    <div className="flex flex-col items-center gap-4 text-center max-w-3xl">
                        <h1 className="hero-title text-5xl md:text-7xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-green-400 bg-clip-text text-transparent leading-tight drop-shadow-lg">
                            AI-Powered News Intelligence
                        </h1>
                    </div>
                    <div className="bg-gradient-to-br from-gray-800 via-gray-900 to-black rounded-xl shadow-2xl border border-gray-600/50 p-4 sm:p-6 backdrop-blur-sm w-full max-w-2xl flex flex-col items-center gap-4 sm:gap-6">

                        <p className="text-xl md:text-2xl text-gray-300 max-w-2xl font-light">
                            Get breaking news analysis and real-time intelligence from global sources.
                        </p>
                        {/* Email Capture Form - Industrial dark styling */}
                        <form onSubmit={handleEmailSubmit} className="w-full">
                            <div>

                                <div className="space-y-3 sm:space-y-4">
                                    <Input
                                        type="email"
                                        placeholder="your.email@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled={isSubmitting}
                                        required
                                        className="h-10 sm:h-12 text-base sm:text-lg bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:ring-emerald-500 focus:bg-gray-700"
                                    />

                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full h-10 sm:h-12 text-base sm:text-lg font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg hover:shadow-xl transition-all duration-200 border border-emerald-500/30"
                                    >
                                        {isSubmitting ? "Setting up your briefings..." : "Get Free Daily Briefings →"}
                                    </Button>

                                    {submitMessage && (
                                        <p className={`text-sm text-center ${submitMessage.includes('🎉') ? 'text-green-400' : 'text-red-400'}`}>
                                            {submitMessage}
                                        </p>
                                    )}

                                    <p className="text-sm text-gray-300 text-center">
                                        🔒 Your email is secure. We respect your privacy and never share your data.
                                    </p>
                                </div>
                            </div>
                        </form>
                    </div>

                    {/* Secondary CTA for Account Creation - Industrial styling */}
                    <div className="text-center">
                        <p className="text-gray-200 mb-3">
                            Want advanced features and premium insights?
                        </p>
                        <Link href="/sign-up">
                            <Button variant="outline" className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-200 backdrop-blur-sm bg-gray-900/50">
                                Create Free Account
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

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
                    ) : initialReports.length > 0 ? (
                        initialReports.slice(0, 4).map(report => (
                            <ReportCard
                                key={report.reportId}
                                report={report}
                            />
                        ))
                    ) : (
                        <div className="col-span-2 text-center py-8">
                            <p className="text-gray-200">
                                No reports found.
                            </p>
                        </div>
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
