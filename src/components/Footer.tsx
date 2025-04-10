import { Separator } from "@/components/ui/separator"
import Link from "next/link"

export default function Footer() {
    return (
        <footer className="bg-muted-light py-6">
            <div className="container mx-auto px-8 min-w-[90%]">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    <div className="space-y-4">
                        <h3 className="text-lg font-bold">AI World News</h3>
                        <p className="text-sm text-muted-foreground">
                            AI-powered news for everyone.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Navigation</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <Link href="/" className="hover:underline">
                                    Home
                                </Link>
                            </li>
                            <li>
                                <Link href="/executive-orders" className="hover:underline">
                                    Executive Orders
                                </Link>
                            </li>
                            <li>
                                <Link href="/current-events" className="hover:underline">
                                    Current Events
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold">Contact</h4>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a href="https://twitter.com/org_intel" className="hover:underline">
                                    Twitter
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <Separator className="my-6" />
                <div className="flex flex-col items-center gap-4">
                    <p className="text-center text-sm text-muted-foreground">
                        &copy; {new Date().getFullYear()} AI World News. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
} 