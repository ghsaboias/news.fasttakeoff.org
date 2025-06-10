'use client';

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function ReportCardSkeleton() {
    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4 animate-pulse">
            <CardHeader className="space-y-2">
                <div className="flex justify-between gap-2 mb-1 items-center">
                    <div className="flex flex-row gap-2 items-center">
                        <div className="h-5 w-20 bg-muted rounded" />
                    </div>
                    <div className="h-3 w-16 bg-muted rounded" />
                </div>
                <div className="h-6 w-3/4 bg-muted rounded mb-2" />
                <div className="h-4 w-1/2 bg-muted rounded" />
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <div className="text-sm flex-grow space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-4 bg-muted rounded w-${i === 2 ? '3/4' : i === 4 ? '2/3' : 'full'}`} />
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                <div className="h-8 w-full bg-muted rounded" />
                <div className="flex flex-row gap-1 justify-between w-full items-center">
                    <div className="h-5 w-12 bg-muted rounded" />
                    <div className="h-6 w-16 bg-muted rounded" />
                </div>
            </CardFooter>
        </Card>
    );
} 