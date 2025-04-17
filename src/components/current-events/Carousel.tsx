"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Carousel, CarouselApi, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Report } from "@/lib/types/core";
import { useEffect, useState } from "react";
import ReportCard from "./ReportCard";

export default function ReportsCarousel({ reports, loading }: { reports: Report[], loading: boolean }) {
    const [api, setApi] = useState<CarouselApi | null>(null)
    const [current, setCurrent] = useState(0)
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!api) return

        setCount(api.scrollSnapList().length)
        setCurrent(api.selectedScrollSnap())

        const handleSelect = () => {
            setCurrent(api.selectedScrollSnap())
        }

        api.on('select', handleSelect)
        return () => {
            api.off('select', handleSelect)
        }
    }, [api, reports])

    return (
        <Carousel
            opts={{
                align: "start",
                loop: false,
            }}
            setApi={setApi}
        >
            <CarouselContent className={`${loading || (!loading && reports.length === 0) ? 'flex items-center justify-center' : 'md:-ml-4'}`}>
                {loading ? (
                    <CarouselItem className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 sm:min-w-[360px] min-w-[100%]">
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
                            className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 sm:min-w-[360px] min-w-[100%]"
                        >
                            <ReportCard report={report} />
                        </CarouselItem>
                    ))?.slice(0, 10)
                ) : (
                    <CarouselItem className="basis-full sm:basis-1/2 md:basis-1/3 lg:basis-1/3 sm:min-w-[360px] min-w-[100%]">
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
            {/* Navigation Dots (visible on all screens) */}
            {reports.length > 1 && !loading && (
                <div className="flex justify-center mt-4 space-x-2">
                    {Array.from({ length: count }).map((_, index) => (
                        <button
                            key={index}
                            className={`h-2 w-2 rounded-full transition-colors ${current === index ? 'bg-primary' : 'bg-muted'}`}
                            onClick={() => api?.scrollTo(index)}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </Carousel>
    );
}