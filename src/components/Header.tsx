"use client"

import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import { UserButton, useUser } from "@clerk/nextjs";
import { ChevronDown, Menu, UserIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "./ui/dropdown-menu";

export default function Header() {
    const { user } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

    // Use the consolidated geolocation hook
    const { isUSBased } = useGeolocation({ initialValue: false });

    return (
        <header className="mx-auto flex h-16 items-center justify-between sm:px-8 bg-dark-900 px-4 shadow-dark gap-4 border-b border-dark-700">
            <Link href="/" className="flex items-center gap-2 text-xl text-accent font-semibold">
                <Image src="/images/brain_transparent.png" alt="Fast Takeoff News" width={32} height={32} priority />
                <p className="hidden lg:block">Fast Takeoff News</p>
            </Link>
            <div className="items-center gap-6 hidden min-[700px]:flex text-dark-100">
                {
                    isUSBased && (
                        <>
                            <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                                Executive Orders
                            </Link>
                        </>
                    )
                }
                <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    Current Events
                </Link>
                <Link href="/feeds" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    Feeds
                </Link>
                <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    Market Feed
                </Link>
                <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    News Globe
                </Link>
                <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    Brazil
                </Link>
                <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-center">
                    Power Network
                </Link>
                <div onMouseLeave={() => setIsAnalyticsOpen(false)}>
                    <DropdownMenu open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen} modal={false}>
                        <DropdownMenuTrigger
                            className="text-sm font-medium hover:text-accent transition-colors text-center inline-flex items-center gap-1 outline-none focus:outline-none pb-1"
                            onMouseEnter={() => setIsAnalyticsOpen(true)}
                        >
                            Analytics
                            <ChevronDown className="h-3 w-3" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-dark-800 border-dark-700 mt-[-4px]">
                            <DropdownMenuItem asChild className="focus:outline-none">
                                <Link href="/analytics/entities" className="text-dark-100 hover:text-accent cursor-pointer focus:outline-none">
                                    Entities
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="focus:outline-none">
                                <Link href="/analytics/heatmap" className="text-dark-100 hover:text-accent cursor-pointer focus:outline-none">
                                    Heatmap
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="focus:outline-none">
                                <Link href="/analytics/word-cloud" className="text-dark-100 hover:text-accent cursor-pointer focus:outline-none">
                                    Word Cloud
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild className="focus:outline-none">
                                <Link href="/analytics/trump-timeline" className="text-dark-100 hover:text-accent cursor-pointer focus:outline-none">
                                    Trump Timeline
                                </Link>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
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
                                    className="min-[700px]:hidden bg-transparent border-dark-600 text-dark-100 hover:bg-dark-800"
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] bg-dark-900 border-dark-700">
                                <SheetHeader>
                                    <SheetTitle className="text-dark-100">Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    {
                                        isUSBased && (
                                            <>
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Current Events
                                    </Link>
                                    <Link href="/feeds" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Feeds
                                    </Link>
                                    <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Market Feed
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Brazil
                                    </Link>
                                    <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Power Network
                                    </Link>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="text-sm font-medium hover:text-accent transition-colors text-dark-100 inline-flex items-center gap-1">
                                            Analytics
                                            <ChevronDown className="h-3 w-3" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-dark-800 border-dark-700">
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/entities" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Entities
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/heatmap" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Heatmap
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/word-cloud" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Word Cloud
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/trump-timeline" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Trump Timeline
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link href="/sign-in" prefetch>
                            <Button variant="outline" size="sm" className="border-dark-600 text-dark-100 hover:bg-dark-800">
                                Sign In
                            </Button>
                        </Link>
                        <Link href="/sign-up">
                            <Button variant="default" size="sm" className="bg-industrial-gradient text-white hover:brightness-110 hover:shadow-industrial-lg transition-all">
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
                                    className="min-[700px]:hidden border-dark-600 text-dark-100 hover:bg-dark-800"
                                >
                                    <Menu className="h-5 w-5" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px] bg-dark-900 border-dark-700">
                                <SheetHeader>
                                    <SheetTitle className="text-dark-100">Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    {
                                        isUSBased && (
                                            <>
                                                <Link href="/executive-orders" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                                    Executive Orders
                                                </Link>
                                            </>
                                        )
                                    }
                                    <Link href="/current-events" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Current Events
                                    </Link>
                                    <Link href="/mktfeed" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Market Feed
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        News Globe
                                    </Link>
                                    <Link href="/brazil" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Brazil
                                    </Link>
                                    <Link href="/power-network" className="text-sm font-medium hover:underline hover:text-accent transition-colors text-dark-100">
                                        Power Network
                                    </Link>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger className="text-sm font-medium hover:text-accent transition-colors text-dark-100 inline-flex items-center gap-1">
                                            Analytics
                                            <ChevronDown className="h-3 w-3" />
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="bg-dark-800 border-dark-700">
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/entities" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Entities
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/heatmap" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Heatmap
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/word-cloud" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Word Cloud
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href="/analytics/trump-timeline" className="text-dark-100 hover:text-accent cursor-pointer">
                                                    Trump Timeline
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                )
            }
        </header>
    )
}
