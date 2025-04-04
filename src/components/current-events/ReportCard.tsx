import { Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "../ui/card";
import LinkBadge from "./LinkBadge";

export default function ReportCard({ report }: { report: Report }) {
    return (
        <Card className="h-[380px] flex flex-col gap-2 py-4">
            <CardHeader>
                <div className="flex justify-between gap-2 mb-1 items-center">
                    {report.channelName && (
                        <LinkBadge href={`/current-events/${report.channelId}`} variant="outline" className="px-1 py-0 h-5 hover:bg-muted">
                            {report.channelName}
                        </LinkBadge>
                    )}
                    <Badge variant="secondary">
                        {report?.timeframe}
                    </Badge>
                </div>
                <CardTitle className="text-lg font-semibold line-clamp-2 leading-tight">
                    {report.headline}
                </CardTitle>
                <p className="text-sm text-muted-foreground line-clamp-1">{report.city}</p>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col pt-0">
                <p className="text-sm text-muted-foreground flex-grow overflow-scroll h-16">
                    {report.body}
                </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2 justify-between items-start my-2">
                <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                        Read More
                    </Link>
                </Button>
                <div>

                    <span className="text-xs text-muted-foreground">
                        Generated: {report.generatedAt ? formatTime(report.generatedAt) : 'Recent'}
                    </span>
                    <div className="text-xs text-muted-foreground">
                        {report.messageCountLastHour && (
                            <div>
                                <span className="font-medium">{report.messageCountLastHour}</span> update{report.messageCountLastHour === 1 ? '' : 's'} in the last {report.timeframe}
                            </div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}