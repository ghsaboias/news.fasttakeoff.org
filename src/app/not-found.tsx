'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <CardTitle className="text-4xl font-bold">404</CardTitle>
                    <CardDescription className="text-xl mt-2">Page Not Found</CardDescription>
                </CardHeader>
                <Separator className="my-4" />
                <CardContent className="flex flex-col items-center space-y-4">
                    <p className="text-muted-foreground text-center">
                        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
                    </p>
                    <Button asChild className="w-full sm:w-auto">
                        <Link href="/">
                            Return Home
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}