"use client"

import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu, UserIcon } from "lucide-react";
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
        <header className="mx-auto flex h-16 items-center justify-between sm:px-8 bg-foreground px-4 shadow-sm gap-4">
            <Link href="/" className="flex items-center gap-2 text-xl text-[#167F6E] font-semibold">
                <Image src="/images/brain_transparent.webp" alt="Fast Takeoff News" width={32} height={32} priority />
                <p className="hidden lg:block">Fast Takeoff News</p>
            </Link>
            <div className="items-center gap-6 hidden min-[700px]:flex text-background">
                {
                    isUSBased && (
                        <>
                            <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                                Executive Orders
                            </Link>
                        </>
                    )
                }
                <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Current Events
                </Link>
                <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Market Feed
                </Link>
                <Link href="/entities" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Entities
                </Link>
                <Link href="/message-activity" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Heatmap
                </Link>
                <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    News Globe
                </Link>
                <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Brazil
                </Link>
                <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors text-center">
                    Power Network
                </Link>
            </div>
            {
                user ? (
                    <div className="flex items-center gap-4">
                        <UserButton>
                            <UserButton.MenuItems>
                                <UserButton.Link href="/profile" label="Profile" labelIcon={<UserIcon />} />
                            </UserButton.MenuItems>
                        </UserButton>
                        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label="Open navigation menu"
                                    aria-expanded={isMenuOpen}
                                    aria-controls="mobile-navigation"
                                    className="min-[700px]:hidden bg-transparent"
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
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Current Events
                                    </Link>
                                    <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Market Feed
                                    </Link>
                                    <Link href="/entities" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Entities
                                    </Link>
                                    <Link href="/message-activity" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Heatmap
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Brazil
                                    </Link>
                                    <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Power Network
                                    </Link>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link href="/sign-in" prefetch>
                            <Button variant="outline" size="sm">
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button variant="default" size="sm">
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
                                    className="min-[700px]:hidden text-background"
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
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Current Events
                                    </Link>
                                    <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Market Feed
                                    </Link>
                                    <Link href="/entities" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Entities
                                    </Link>
                                    <Link href="/message-activity" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Heatmap
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Brazil
                                    </Link>
                                    <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-[#167F6E] transition-colors">
                                        Power Network
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
