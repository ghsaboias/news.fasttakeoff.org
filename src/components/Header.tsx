"use client"

import { Button } from "@/components/ui/button";
import { UserButton, useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function Header() {
    const { user } = useUser()

    return (
        <header className="border-b mx-auto flex h-16 items-center justify-between sm:px-8 sm:w-[95vw] w-[90vw]">
            <div className="flex items-center gap-2">
                <Link href="/" className="text-xl font-bold">
                    Fast Takeoff News
                </Link>
            </div>
            <nav className="hidden md:flex items-center gap-6">
                <Link href="/" className="text-sm font-medium hover:underline">
                    Home
                </Link>
                <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                    Executive Orders
                </Link>
                <Link href="/current-events" className="text-sm font-medium hover:underline">
                    Current Events
                </Link>
            </nav>
            {
                user ? (
                    <div className="flex items-center gap-4">
                        <UserButton />
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Link href="/sign-in" prefetch>
                            <Button variant="outline" size="sm">
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button size="sm">
                                Subscribe
                            </Button>
                        </Link>
                    </div>
                )
            }
        </header>
    )
} 