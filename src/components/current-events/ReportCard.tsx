'use client';

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import ReportCardContent from "./ReportCardContent";
import ReportCardFooter from "./ReportCardFooter";
import ReportCardHeader from "./ReportCardHeader";

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

    // Prepare props for ReportCardHeader
    const headerProps = {
        headline: report.headline,
        city: report.city,
        timestampDisplay: report.generatedAt ? formatTime(report.generatedAt, true) : 'Recent',
        displayChannelInfo: showChannelName,
        channelName: report.channelName,
        channelHref: showChannelName && clickableChannel && report.channelId ? `/current-events/${report.channelId}` : undefined,
        reportCount: showChannelName ? reportCount : undefined,
    };

    // Prepare props for ReportCardContent
    const contentProps = {
        body: report.body,
    };

    // Prepare props for ReportCardFooter
    const footerProps = {
        readMoreHref: showReadMore && report.channelId && report.reportId ? `/current-events/${report.channelId}/${report.reportId}` : undefined,
        timeframeText: showTimeframe && report.timeframe ? report.timeframe : undefined,
        itemCount: report.messageCount,
        itemUnitSingular: clickableReport ? 'source' : 'update',
        itemCountIsLink: clickableReport,
        itemCountLinkHref: clickableReport && report.channelId && report.reportId ? `/current-events/${report.channelId}/${report.reportId}` : undefined,
    };

    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4">
            <CardHeader>
                <ReportCardHeader {...headerProps} />
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <ReportCardContent {...contentProps} />
            </CardContent>
            {/* Conditionally render CardFooter only if ReportCardFooter has content */}
            {(footerProps.readMoreHref || footerProps.timeframeText || (footerProps.itemCount !== undefined && footerProps.itemUnitSingular)) && (
                <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                    <ReportCardFooter {...footerProps} />
                </CardFooter>
            )}
        </Card>
    )
}