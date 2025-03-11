'use client'

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function CurrentEventsPage() {
    return (
        <div className="container mx-auto px-4 py-8 md:py-12">
            <div className="mb-8">
                <Button variant="ghost" size="sm" asChild className="mb-4">
                    <Link href="/">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Home
                    </Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl mb-2">Latest News</h1>
                <p className="text-muted-foreground">Stay updated with the latest developments in AI governance and policy</p>
            </div>

            <Card className="p-8 text-center max-w-3xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl mb-2">Coming Soon</CardTitle>
                    <CardDescription className="text-lg">
                        We're working on bringing you the latest news and updates in AI governance and policy.
                    </CardDescription>
                </CardHeader>
                <div className="my-8 space-y-4">
                    <p>Our team is currently developing this section to provide you with:</p>
                    <ul className="list-disc text-left max-w-md mx-auto space-y-2">
                        <li>Breaking news on AI regulations and policies</li>
                        <li>Analysis of recent developments in AI governance</li>
                        <li>Expert opinions on the impact of new AI technologies</li>
                        <li>Updates on international AI initiatives and collaborations</li>
                    </ul>
                </div>
                <CardFooter className="flex justify-center">
                    <Button asChild>
                        <Link href="/executive-orders">
                            Explore Executive Orders Instead
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
