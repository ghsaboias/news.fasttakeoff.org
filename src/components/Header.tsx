"use client"

import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
interface UserObject {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
}

export default function Header({ user }: { user: UserObject | null }) {
    return (
        <header className="border-b">
            <div className="mx-auto flex h-16 items-center justify-between px-8">
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
                            <Link href="/sign-in">
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
            </div>
        </header>
    )
} 