"use client"

import { Button } from "@/components/ui/button";
import { getAIProviderConfig } from "@/lib/ai-config";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

export default function Header() {
    const { user } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const aiConfig = getAIProviderConfig();

    return (
        <header className="mx-auto flex h-16 items-center justify-between sm:px-8 sm:w-[95vw] w-[90vw]">
            <Link href="/" className="flex items-center gap-2 text-xl text-[#167F6E] font-semibold">
                <Image src="/images/brain_transparent.png" alt="Fast Takeoff News" width={32} height={32} />
                <p className="hidden min-[840px]:block">Fast Takeoff News</p>
            </Link>
            <div className="items-center gap-6 hidden min-[540px]:flex">
                <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                    Executive Orders
                </Link>
                <Link href="/current-events" className="text-sm font-medium hover:underline">
                    Current Events
                </Link>
                <Link href="/news-globe" className="text-sm font-medium hover:underline">
                    News Globe
                </Link>
            </div>
            {
                user ? (
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="hidden md:block">
                            {aiConfig.displayName}
                        </Badge>
                        <Link href="/profile" className="text-sm font-medium hover:underline">Profile</Link>
                        <UserButton />
                        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <SheetTrigger asChild>
                                <Menu className="min-[540px]:hidden" />
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px]">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                        Executive Orders
                                    </Link>
                                    <Link href="/current-events" className="text-sm font-medium hover:underline">
                                        Current Events
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline">
                                        News Globe
                                    </Link>
                                    <Badge variant="secondary">
                                        {aiConfig.displayName}
                                    </Badge>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="hidden md:block">
                            {aiConfig.displayName}
                        </Badge>
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
                                <Menu className="min-[540px]:hidden" />
                            </SheetTrigger>
                            <SheetContent side="right" className="w-[300px]">
                                <SheetHeader>
                                    <SheetTitle>Menu</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 mt-8 justify-center items-center">
                                    <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                                        Executive Orders
                                    </Link>
                                    <Link href="/current-events" className="text-sm font-medium hover:underline">
                                        Current Events
                                    </Link>
                                    <Link href="/news-globe" className="text-sm font-medium hover:underline">
                                        News Globe
                                    </Link>
                                    <Badge variant="secondary">
                                        {aiConfig.displayName}
                                    </Badge>
                                </div>
                            </SheetContent>
                        </Sheet>
                    </div>
                )
            }
        </header>
    )
} 