'use client'

import { Separator } from "@/components/ui/separator";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import Link from "next/link";

export default function Footer() {
    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ initialValue: false });

    return (
        <footer className="bg-dark-900 py-6 border-t border-dark-700">
            <div className="container mx-auto px-8 min-w-[90%]">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="space-y-4 text-center">
                        <h3 className="text-lg font-bold text-dark-100">Fast Takeoff News</h3>
                        <p className="text-sm text-dark-300">
                            AI-powered news for everyone.
                        </p>
                    </div>
                    <div className="space-y-4 text-center">
                        <h4 className="text-sm font-semibold text-dark-100">Navigation</h4>
                        <ul className="space-y-2 text-sm text-dark-300">
                            <li>
                                <Link href="/" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Home
                                </Link>
                            </li>
                            {
                                isUSBased && (
                                    <>
                                        <li>
                                            <Link href="/executive-orders" className="hover:underline hover:text-industrial-500 transition-colors">
                                                Executive Orders
                                            </Link>
                                        </li>
                                    </>
                                )
                            }
                            <li>
                                <Link href="/current-events" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Current Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/mktfeed" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Market Feed
                                </Link>
                            </li>
                            <li>
                                <Link href="/message-activity" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Heatmap
                                </Link>
                            </li>
                            <li>
                                <Link href="/news-globe" className="hover:underline hover:text-industrial-500 transition-colors">
                                    News Globe
                                </Link>
                            </li>
                            <li>
                                <Link href="/brazil" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Brazil News
                                </Link>
                            </li>
                            <li>
                                <Link href="/power-network" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Power Network
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4 text-center">
                        <h4 className="text-sm font-semibold text-dark-100">Contact</h4>
                        <ul className="space-y-2 text-sm text-dark-300">
                            <li>
                                <a href="https://x.com/fasttakeoff" className="hover:underline hover:text-industrial-500 transition-colors">
                                    X
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/fast.takeoff.news/" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Instagram
                                </a>
                            </li>
                            <li>
                                <a href="https://www.facebook.com/profile.php?id=61577293156084" className="hover:underline hover:text-industrial-500 transition-colors">
                                    Facebook
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <Separator className="my-6 bg-dark-600" />
                <div className="flex flex-col items-center gap-4">
                    <p className="text-center text-sm text-dark-400">
                        &copy; {new Date().getFullYear()} Fast Takeoff News. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
} 