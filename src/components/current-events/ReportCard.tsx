import { Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import LinkBadge from "./LinkBadge";

export default function ReportCard({ report, channelsPage = false }: { report: Report, channelsPage?: boolean }) {
    const paragraphs = report.body.split('\n\n').filter(Boolean);
    return (
        <Card className="h-[500px] sm:h-[400px] flex flex-col gap-2 py-4">
            <CardHeader>
                <div className="flex justify-between gap-2 mb-1 items-center">
                    {!channelsPage && report.channelName && (
                        <>
                            <LinkBadge href={`/current-events/${report.channelId}`} variant="outline" className="px-1 py-0 h-5 hover:bg-muted">
                                {report.channelName}
                            </LinkBadge>
                            <Badge variant="secondary">
                                {report?.timeframe}
                            </Badge>
                        </>
                    )}
                </div>
                <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                    {report.headline}
                </CardTitle>
                <p className="text-sm font-medium line-clamp-1">{report.city}</p>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <div className="text-sm flex-grow overflow-scroll h-16">
                    {paragraphs.map((paragraph, index) => (
                        <p key={index} className="mb-2 last:mb-0">
                            {paragraph}
                        </p>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                {!channelsPage && (
                    <Button asChild variant="outline" size="sm" className="w-full">
                        <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                            Read More
                        </Link>
                    </Button>
                )}
                <div className="flex justify-between items-center w-full">
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground">
                            {report.generatedAt ? formatTime(report.generatedAt, true) : 'Recent'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {report.messageCount && (
                                <div>
                                    <span className="font-medium">{report.messageCount}</span> update{report.messageCount === 1 ? '' : 's'} in the last {report.timeframe}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}