'use client';

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportCardSkeleton() {
    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4">
            <CardHeader className="space-y-2">
                <div className="flex justify-between gap-2 mb-1 items-center">
                    <div className="flex flex-row gap-2 items-center">
                        <Skeleton className="h-5 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <div className="text-sm flex-grow space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className={`h-4 ${i === 2 ? 'w-3/4' : i === 4 ? 'w-2/3' : 'w-full'}`} />
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                <Skeleton className="h-8 w-full" />
                <div className="flex flex-row gap-1 justify-between w-full items-center">
                    <Skeleton className="h-5 w-12" />
                    <Skeleton className="h-6 w-16" />
                </div>
            </CardFooter>
        </Card>
    );
} 