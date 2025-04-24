'use client';

import { Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import LinkBadge from "./LinkBadge";

interface ReportCardProps {
    report: Report;
    reportCount?: number;
    showChannelName?: boolean;
    showTimeframe?: boolean;
    clickableChannel?: boolean;
    showReadMore?: boolean;
    clickableReport?: boolean;
}

export default function ReportCard({
    report,
    reportCount,
    showChannelName = true,
    showTimeframe = true,
    clickableChannel = true,
    clickableReport = false,
    showReadMore = true
}: ReportCardProps) {
    const paragraphs = report.body.split('\n\n').filter(Boolean);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    const checkIfAtBottom = () => {
        const element = contentRef.current;
        if (element) {
            const { scrollTop, scrollHeight, clientHeight } = element;
            const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1;
            setIsAtBottom(isBottom);
        }
    };

    useEffect(() => {
        const element = contentRef.current;
        if (element) {
            element.addEventListener('scroll', checkIfAtBottom);
            // Check initial position
            checkIfAtBottom();
        }

        return () => {
            if (element) {
                element.removeEventListener('scroll', checkIfAtBottom);
            }
        };
    }, []);

    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4">
            <CardHeader>
                <div className="flex justify-between gap-2 mb-1 items-center">
                    {showChannelName && (
                        <div className="flex flex-row gap-2">
                            {clickableChannel ? (
                                <LinkBadge
                                    href={`/current-events/${report.channelId}`}
                                    variant="outline"
                                    className="px-1 py-0 h-5 hover:bg-muted"
                                >
                                    {report.channelName}
                                </LinkBadge>
                            ) : (
                                <Badge variant="secondary" className="px-1 py-0 h-5">
                                    {report.channelName}
                                </Badge>
                            )}
                            {reportCount && (
                                <Badge variant="secondary" className="px-1 py-0 h-5">
                                    {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                                </Badge>
                            )}
                        </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                        {report.generatedAt ? formatTime(report.generatedAt, true) : 'Recent'}
                    </div>
                </div>
                <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                    {report.headline}
                </CardTitle>
                <p className="text-sm font-medium line-clamp-1">{report.city}</p>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <div className="text-sm flex-grow h-16 relative">
                    <div
                        ref={contentRef}
                        className="overflow-y-auto h-full scrollbar-none hover:scrollbar-thin hover:scrollbar-track-transparent hover:scrollbar-thumb-gray-300"
                    >
                        {paragraphs.map((paragraph, index) => (
                            <p key={index} className="mb-2 last:mb-0 text-justify">
                                {paragraph}
                            </p>
                        ))}
                    </div>
                    {!isAtBottom && (
                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none z-10"></div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                {showReadMore && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                            Read More
                        </Link>
                    </Button>
                )}
                <div className="flex flex-row gap-1 justify-between w-full items-center">

                    {showTimeframe && report.timeframe && (
                        <Badge variant="secondary" className="px-1 py-0 h-5">
                            {report.timeframe}
                        </Badge>
                    )}
                    {
                        clickableReport ? (
                            <Button variant="outline" size="sm">
                                <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                                    <span className="font-medium">{report.messageCount}</span> source{report.messageCount === 1 ? '' : 's'}
                                </Link>
                            </Button>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                {report.messageCount && (
                                    <div>
                                        <span className="font-medium">{report.messageCount}</span> update{report.messageCount === 1 ? '' : 's'}
                                    </div>
                                )}
                            </div>
                        )
                    }
                </div>
            </CardFooter>
        </Card>
    )
}