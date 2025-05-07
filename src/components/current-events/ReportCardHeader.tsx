'use client';

import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card"; // Assuming CardTitle is used directly, or adjust if it's just for styling
import LinkBadge from "./LinkBadge";

interface ReportCardHeaderProps {
    headline: string;
    city: string;
    timestampDisplay: string;
    channelName?: string;
    channelHref?: string;
    reportCount?: number;
    displayChannelInfo?: boolean;
}

export default function ReportCardHeader({
    headline,
    city,
    timestampDisplay,
    channelName,
    channelHref,
    reportCount,
    displayChannelInfo = true, // Defaulting to true, parent can override
}: ReportCardHeaderProps) {
    return (
        <>
            <div className="flex justify-between gap-2 mb-1 items-center">
                {displayChannelInfo && channelName ? (
                    <div className="flex flex-row gap-2 items-center">
                        {channelHref ? (
                            <LinkBadge
                                href={channelHref}
                                variant="outline"
                                className="px-1 py-0 h-5 hover:bg-muted"
                            >
                                {channelName}
                            </LinkBadge>
                        ) : (
                            <Badge variant="secondary" className="px-1 py-0 h-5">
                                {channelName}
                            </Badge>
                        )}
                        {reportCount !== undefined && (
                            <Badge variant="secondary" className="px-1 py-0 h-5">
                                {reportCount} {reportCount === 1 ? 'report' : 'reports'}
                            </Badge>
                        )}
                    </div>
                ) : (
                    <div /> // Empty div to maintain space for justify-between if channel info is not shown
                )}
                <div className="text-xs text-muted-foreground">
                    {timestampDisplay}
                </div>
            </div>
            <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                {headline}
            </CardTitle>
            <p className="text-sm font-medium line-clamp-1">{city}</p>
        </>
    );
} 