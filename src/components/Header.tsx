"use client"

import { Button } from "@/components/ui/button";
import { API } from "@/lib/config";
import { UserButton, useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "./ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";

export default function Header() {
    const { user } = useUser()
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="border-b mx-auto flex h-16 items-center justify-between sm:px-8 sm:w-[95vw] w-[90vw]">
            <div className="flex items-center gap-2">
                <Link href="/" className="text-xl font-bold">
                    Fast Takeoff News
                </Link>
            </div>
            <div className="items-center gap-6 hidden md:flex">
                <Link href="/executive-orders" className="text-sm font-medium hover:underline">
                    Executive Orders
                </Link>
                <Link href="/current-events" className="text-sm font-medium hover:underline">
                    Current Events
                </Link>
            </div>
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                <SheetTrigger asChild>
                    <Menu className="md:hidden" />
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
                        <Badge variant="secondary">
                            {API.GROQ.MODEL_NAME}
                        </Badge>
                    </div>
                </SheetContent>
            </Sheet>
            {
                user ? (
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="hidden md:block">
                            {API.GROQ.MODEL_NAME}
                        </Badge>
                        <Link href="/profile" className="text-sm font-medium hover:underline">Profile</Link>
                        <UserButton />
                    </div>
                ) : (
                    <div className="flex items-center gap-4">
                        <Badge variant="secondary" className="hidden md:block">
                            {API.GROQ.MODEL_NAME}
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
                    </div>
                )
            }
        </header>
    )
} 