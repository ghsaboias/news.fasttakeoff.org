'use client';

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import LocalDateTime from "@/components/utils/LocalDateTime";
import { TIME } from "@/lib/config";
import { Report } from "@/lib/types/core";
import Link from "next/link";
import LinkBadge from "./LinkBadge";

interface ReportCardProps {
    report: Report;
    clickableChannel?: boolean;
}

export default function ReportCard({
    report,
    clickableChannel = true,
}: ReportCardProps) {
    // Calculate derived values
    const channelHref = clickableChannel && report.channelId ? `/current-events/${report.channelId}` : undefined;
    const itemUnitSingular = 'source';
    const itemCountLinkHref = report.channelId && report.reportId ? `/current-events/${report.channelId}/${report.reportId}` : undefined;
    const paragraphs = report.body.split('\n\n').filter(Boolean);
    const itemUnitText = report.messageCount === 1 ? itemUnitSingular : itemUnitSingular ? `${itemUnitSingular}s` : '';

    // This regex matches most emoji at the start of a string
    const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/u;
    // const match = report.channelName?.match(emojiRegex);
    // const leadingEmoji = match ? match[0] : undefined;
    const channelNameWithoutEmoji = report.channelName?.replace(emojiRegex, '').trim();

    // Helper to convert timeframe string to ms
    function timeframeToMs(timeframe?: string): number | undefined {
        if (!timeframe) return undefined;
        if (timeframe === '2h') return TIME.TWO_HOURS_MS;
        if (timeframe === '6h') return TIME.SIX_HOURS_MS;
        return undefined;
    }

    return (
        <Card className="flex flex-col gap-4">
            <CardHeader>
                <CardTitle className="text-2xl font-semibold line-clamp-4 leading-tight hover:text-accent">
                    <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                        {report.headline}
                    </Link>
                </CardTitle>
                <div className="flex justify-between items-center">
                    <p className="text-md font-medium line-clamp-1">
                        {report.city.charAt(0).toUpperCase() + report.city.toLowerCase().slice(1)} - {report.generatedAt && report.timeframe ? (
                            (() => {
                                const end = new Date(report.generatedAt);
                                const ms = timeframeToMs(report.timeframe);
                                if (!ms) return 'Recent';
                                const start = new Date(end.getTime() - ms);
                                return (
                                    <>
                                        <LocalDateTime dateString={start.toISOString()} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
                                        {" - "}
                                        <LocalDateTime dateString={end.toISOString()} options={{ timeStyle: 'short' }} />
                                    </>
                                );
                            })()
                        ) : (
                            'Recent'
                        )}
                    </p>
                </div>
            </CardHeader>

            <CardContent className="flex flex-col pt-0">
                <div className="text-md">
                    {paragraphs.length > 0 && (
                        <p className="text-justify">
                            {paragraphs[0]}
                        </p>
                    )}
                </div>
            </CardContent>

            {/* Footer with all tags and actions */}
            <CardFooter className="flex flex-col gap-2 justify-between items-start">
                <div className="flex items-end justify-between w-full gap-2">
                    <div className="flex items-center gap-2">
                        {report.channelName && (
                            channelHref ? (
                                <LinkBadge
                                    href={channelHref}
                                    variant="outline"
                                    className="px-1 py-0 h-5 hover:bg-accent"
                                >
                                    {channelNameWithoutEmoji}
                                </LinkBadge>
                            ) : (
                                <Badge variant="secondary" className="px-1 py-0 h-5">
                                    {channelNameWithoutEmoji}
                                </Badge>
                            )
                        )}
                        {(report.messageCount !== undefined && itemUnitSingular) && (
                            itemCountLinkHref ? (
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
                    </div>
                </div>
            </CardFooter>
        </Card >
    )
}