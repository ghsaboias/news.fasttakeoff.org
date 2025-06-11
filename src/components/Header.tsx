"use client"

import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

export default function Header() {
    const { user } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ initialValue: false });

    return (
        <header className="mx-auto flex h-16 items-center justify-between sm:px-8 bg-foreground px-4 ">
            <Link href="/" className="flex items-center gap-2 text-xl text-[#167F6E] font-semibold">
                <Image src="/images/brain_transparent.webp" alt="Fast Takeoff News" width={32} height={32} priority />
                <p className="hidden lg:block">Fast Takeoff News</p>
            </Link>
            <div className="items-center gap-6 hidden min-[600px]:flex text-background">
                {
                    isUSBased && (
                        <>
                            <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                Executive Orders
                            </Link>
                        </>
                    )
                }
                <Link href="/current-events" className="text-sm font-medium hover:underline">
                    Current Events
                </Link>
                <Link href="/news-globe" className="text-sm font-medium hover:underline">
                    News Globe
                </Link>
                <Link href="/brazil-news" className="text-sm font-medium hover:underline">
                    Brazil News
                </Link>
            </div>
            {
                user ? (
                    <div className="flex items-center gap-4">
                        <Link href="/profile" className="text-sm font-medium hover:underline text-background">Profile</Link>
                        <UserButton />
                        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Open navigation menu"
                                    aria-expanded={isMenuOpen}
                                    aria-controls="mobile-navigation"
                                    className="min-[600px]:hidden bg-transparent"
                                >
                                    <Menu className="h-5 w-5 text-background" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px]">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    {
                                        isUSBased && (
                                            <>
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline">
                                        Current Events
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil-news" className="text-sm font-medium hover:underline">
                                        Brazil News
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
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
                        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Open navigation menu"
                                    aria-expanded={isMenuOpen}
                                    aria-controls="mobile-navigation"
                                    className="min-[600px]:hidden text-background"
                                >
                                    <Menu className="h-5 w-5 text-foreground" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px]">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    {
                                        isUSBased && (
                                            <>
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline">
                                        Current Events
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil-news" className="text-sm font-medium hover:underline">
                                        Brazil News
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                )
            }
        </header>
    )
} 