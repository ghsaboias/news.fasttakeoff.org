"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

export default function ReportsCarousel() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    async function fetchReports() {
        try {
            setLoading(true);
            const response = await fetch('/api/reports', {
                method: 'GET',
                headers: { 'Cache-Control': 'no-cache' },
            });
            if (!response.ok) throw new Error(`Failed to fetch reports: ${response.status}`);
            const data = await response.json() as Report[];
            const activeReports = data.filter(report => report.headline !== "NO ACTIVITY IN THE LAST HOUR");
            setReports(activeReports);
        } catch (error) {
            console.error('[Carousel] Error fetching reports:', error);
            setReports([]);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchReports(); // Initial fetch
        const interval = setInterval(() => {
            fetchReports(); // Refresh every 16 minutes
            console.log('[Carousel] Auto-updated reports at', new Date().toISOString());
        }, 16 * 60 * 1000); // 960,000 ms = 16 minutes

        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    return (
        <div className="w-full px-4">
            <Carousel
                className="w-full max-w-full"
                opts={{
                    align: "start",
                    loop: false,
                    dragFree: true,
                    slidesToScroll: 1,
                    containScroll: "trimSnaps",
                }}
            >
                <CarouselContent className={`${loading || (!loading && reports.length === 0) ? 'flex items-center justify-center' : ''} ml-2 md:-ml-4 overflow-x-auto snap-x snap-mandatory`}>
                    {loading ? (
                        <CarouselItem className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 min-w-[200px] sm:min-w-[330px]">
                            <Card className="h-[300px] flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg">Loading...</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">Fetching latest reports...</p>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    ) : reports.length > 0 ? (
                        reports.map((report, index) => (
                            <CarouselItem
                                key={index}
                                className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 min-w-[200px] sm:min-w-[330px] snap-start"
                            >
                                <Card className="h-[350px] flex flex-col gap-2">
                                    <CardHeader>
                                        <div className="flex justify-between gap-2 mb-1 items-center">
                                            {report.channelName && (
                                                <Badge variant="outline" className="px-1 py-0 h-5">
                                                    {report.channelName}
                                                </Badge>
                                            )}
                                            <span className="text-xs text-muted-foreground">
                                                {report.generatedAt ? formatTime(report.generatedAt) : 'Recent'}
                                            </span>
                                        </div>
                                        <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                                            {report.headline}
                                        </CardTitle>
                                        <p className="text-sm text-muted-foreground line-clamp-1">{report.city}</p>
                                    </CardHeader>
                                    <CardContent className="flex-grow flex flex-col pt-0 gap-2">
                                        <p className="text-sm text-muted-foreground flex-grow overflow-scroll h-16">
                                            {report.body}
                                        </p>
                                        <div className="mt-2 text-xs text-muted-foreground">
                                            {report.messageCountLastHour && (
                                                <div>
                                                    <span className="font-medium">{report.messageCountLastHour}</span> updates in the last hour
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                    <CardFooter>
                                        <Button asChild variant="outline" size="sm" className="w-full">
                                            <Link href={`/current-events/${report.channelId}`}>
                                                Read More
                                            </Link>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </CarouselItem>
                        ))
                    ) : (
                        <CarouselItem className="pl-2 md:pl-4 basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/4 min-w-[200px] sm:min-w-[330px] snap-start">
                            <Card className="h-[350px] flex flex-col">
                                <CardHeader>
                                    <CardTitle className="text-lg">No Active Reports</CardTitle>
                                </CardHeader>
                                <CardContent className="flex-grow">
                                    <p className="text-sm text-muted-foreground">Check back later for updates.</p>
                                </CardContent>
                            </Card>
                        </CarouselItem>
                    )}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex" />
                <CarouselNext className="hidden sm:flex" />
            </Carousel>
        </div>
    );
}