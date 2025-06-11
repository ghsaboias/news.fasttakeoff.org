'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { Report } from "@/lib/types/core";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
    // Content scroll state (from ReportCardContent)
    const [isAtBottom, setIsAtBottom] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Scroll detection logic (from ReportCardContent)
    useEffect(() => {
        const element = contentRef.current;
        if (!element) return;

        const checkAndUpdateScrollState = () => {
            if (element.scrollHeight <= element.clientHeight) {
                setIsAtBottom(true);
            } else {
                const { scrollTop, scrollHeight, clientHeight } = element;
                const isBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 1.5;
                setIsAtBottom(isBottom);
            }
        };

        checkAndUpdateScrollState(); // Initial check on mount and when body changes

        element.addEventListener('scroll', checkAndUpdateScrollState);
        // Listen for window resize as clientHeight can change
        window.addEventListener('resize', checkAndUpdateScrollState);

        return () => {
            element.removeEventListener('scroll', checkAndUpdateScrollState);
            window.removeEventListener('resize', checkAndUpdateScrollState);
        };
    }, [report.body]); // Re-run effect if body content changes

    // Calculate derived values
    const channelHref = showChannelName && clickableChannel && report.channelId ? `/current-events/${report.channelId}` : undefined;
    const readMoreHref = showReadMore && report.channelId && report.reportId ? `/current-events/${report.channelId}/${report.reportId}` : undefined;
    const timeframeText = showTimeframe && report.timeframe ? report.timeframe : undefined;
    const itemUnitSingular = clickableReport ? 'source' : 'update';
    const itemCountLinkHref = clickableReport && report.channelId && report.reportId ? `/current-events/${report.channelId}/${report.reportId}` : undefined;
    const paragraphs = report.body.split('\n\n').filter(Boolean);
    const itemUnitText = report.messageCount === 1 ? itemUnitSingular : itemUnitSingular ? `${itemUnitSingular}s` : '';

    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4">
            <CardHeader>
                {/* Header content (from ReportCardHeader) */}
                <div className="flex justify-end gap-2 mb-1 items-center">
                    <div className="text-xs text-foreground">
                        {report.generatedAt ? (
                            <LocalDateTimeFull
                                dateString={report.generatedAt}
                                options={{ dateStyle: 'short', timeStyle: 'short' }}
                            />
                        ) : (
                            'Recent'
                        )}
                    </div>
                </div>
                <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                    {report.headline}
                </CardTitle>
                <p className="text-sm font-medium line-clamp-1">{report.city}</p>
            </CardHeader>

            <CardContent className="flex-grow flex flex-col pt-0">
                {/* Content with scroll (from ReportCardContent) */}
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

            {/* Footer with all tags and actions */}
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                {readMoreHref && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={readMoreHref}>
                            Read More
                        </Link>
                    </Button>
                )}
                <div className="flex flex-wrap justify-between w-full">
                    <div className="flex flex-col flex-wrap gap-2">
                        {showChannelName && report.channelName && (
                            channelHref ? (
                                <LinkBadge
                                    href={channelHref}
                                    variant="outline"
                                    className="px-1 py-0 h-5 hover:bg-accent"
                                >
                                    {report.channelName}
                                </LinkBadge>
                            ) : (
                                <Badge variant="secondary" className="px-1 py-0 h-5">
                                    {report.channelName}
                                </Badge>
                            )
                        )}
                        {(report.messageCount !== undefined && itemUnitSingular) && (
                            clickableReport && itemCountLinkHref ? (
                                <LinkBadge
                                    href={itemCountLinkHref}
                                    variant="outline"
                                    className="px-1 py-0 h-5 hover:bg-accent"
                                >
                                    {report.messageCount} {itemUnitText}
                                </LinkBadge>
                            ) : (
                                <Badge variant="secondary" className="px-1 py-0 h-5">
                                    {report.messageCount} {itemUnitText}
                                </Badge>
                            )
                        )}
                        {reportCount !== undefined && (
                            <Badge variant="secondary" className="px-1 py-0 h-5">
                                {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 items-center justify-center">
                        {timeframeText && (
                            <Badge variant="secondary" className="p-2 text-white">
                                {timeframeText}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}