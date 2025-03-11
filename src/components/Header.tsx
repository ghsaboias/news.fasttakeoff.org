"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function Header() {
    return (
        <header className="border-b">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
                <div className="flex items-center gap-2">
                    <Link href="/" className="text-xl font-bold">
                        AI World News
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
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="sm">
                        Sign In
                    </Button>
                    <Button size="sm">Subscribe</Button>
                </div>
            </div>
        </header>
    )
} 