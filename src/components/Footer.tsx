'use client'

import { Separator } from "@/components/ui/separator";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import Link from "next/link";

export default function Footer() {
    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ initialValue: false });

    return (
        <footer className="bg-input py-6">
            <div className="container mx-auto px-8 min-w-[90%]">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                    <div className="space-y-4 text-center">
                        <h3 className="text-lg font-bold text-card">Fast Takeoff News</h3>
                        <p className="text-sm text-card">
                            AI-powered news for everyone.
                        </p>
                    </div>
                    <div className="space-y-4 text-center">
                        <h4 className="text-sm font-semibold text-card">Navigation</h4>
                        <ul className="space-y-2 text-sm text-card">
                            <li>
                                <Link href="/" className="hover:underline">
                                    Home
                                </Link>
                            </li>
                            {
                                isUSBased && (
                                    <>
                                        <li>
                                            <Link href="/executive-orders" className="hover:underline">
                                                Executive Orders
                                            </Link>
                                        </li>
                                    </>
                                )
                            }
                            <li>
                                <Link href="/current-events" className="hover:underline">
                                    Current Events
                                </Link>
                            </li>
                            <li>
                                <Link href="/news-globe" className="hover:underline">
                                    News Globe
                                </Link>
                            </li>
                            <li>
                                <Link href="/brazil-news" className="hover:underline">
                                    Brazil News
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4 text-center">
                        <h4 className="text-sm font-semibold text-card">Contact</h4>
                        <ul className="space-y-2 text-sm text-card">
                            <li>
                                <a href="https://twitter.com/fasttakeoff" className="hover:underline">
                                    Twitter
                                </a>
                            </li>
                            <li>
                                <a href="https://www.instagram.com/fast.takeoff.news/" className="hover:underline">
                                    Instagram
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <Separator className="my-6 bg-muted-foreground" />
                <div className="flex flex-col items-center gap-4">
                    <p className="text-center text-sm text-card">
                        &copy; {new Date().getFullYear()} Fast Takeoff News. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
} 