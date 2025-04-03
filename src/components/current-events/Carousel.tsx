"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Report } from "@/lib/types/core";
import ReportCard from "./ReportCard";

export default function ReportsCarousel({ reports, loading }: { reports: Report[], loading: boolean }) {
    return (
        <div className="w-full px-4">
            <Carousel
                opts={{
                    align: "start",
                    loop: false,
                }}
                className="w-full max-w-full"
            >
                <CarouselContent className={`${loading || (!loading && reports.length === 0) ? 'flex items-center justify-center' : ''}`}>
                    {loading ? (
                        <CarouselItem className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 min-w-[200px] sm:min-w-[330px]">
                            <Card className="h-[380px] flex flex-col">
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
                                className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 min-w-[200px] sm:min-w-[330px]"
                            >
                                <ReportCard report={report} />
                            </CarouselItem>
                        ))?.slice(0, 10)
                    ) : (
                        <CarouselItem className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 min-w-[200px] sm:min-w-[330px]">
                            <Card className="h-[380px] flex flex-col">
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
                <div className="hidden md:flex">
                    <CarouselPrevious />
                    <CarouselNext />
                </div>
            </Carousel>
        </div>
    );
}