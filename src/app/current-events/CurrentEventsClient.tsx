"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Report } from "@/lib/types/core";
import { convertTimestampToUnixTimestamp, formatTime } from "@/lib/utils";
import { FilterX, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface Props {
    reports: Report[];
    isLoading?: boolean;
}

export default function CurrentEventsClient({ reports: initialReports, isLoading: initialLoading = false }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "recent" | "activity">("recent");
    const [reports, setReports] = useState<Report[]>(initialReports);
    const [isLoading, setIsLoading] = useState(initialLoading);

    useEffect(() => {
        async function fetchReports() {
            try {
                setIsLoading(true);
                const response = await fetch('/api/reports');
                if (!response.ok) throw new Error('Failed to fetch reports');
                const data = await response.json();
                setReports(data);
            } catch (error) {
                console.error('Error fetching reports:', error);
            } finally {
                setIsLoading(false);
            }
        }

        fetchReports();
    }, []);

    const clearSearch = () => setSearchQuery("");

    const metadata = {
        reportCount: reports.length,
        lastUpdated: reports[0]?.generatedAt
    }

    const filteredReports = reports.filter(report =>
        report.channelName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.headline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.body?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const sortedReports = [...filteredReports].sort((a, b) => {
        switch (sortBy) {
            case "activity":
                return (b.messageCountLastHour || 0) - (a.messageCountLastHour || 0);
            case "recent":
                return new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime();
            case "name":
                return (a.channelName || "").localeCompare(b.channelName || "");
            default:
                return 0;
        }
    });

    return (
        <div className="py-8 px-4">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">Current Events</h1>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-2">
                            <Badge variant="secondary">
                                Active Topics: {isLoading ? "Loading..." : reports.length}
                            </Badge>
                        </div>
                        {metadata.lastUpdated && !isLoading && (
                            <span className="text-xs text-muted-foreground">
                                Last updated: {new Date(metadata.lastUpdated).toISOString().substring(11, 19)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search topics..."
                            value={searchQuery}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            className="pl-8 pr-8 max-w-sm"
                            disabled={isLoading}
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-9 px-2"
                                onClick={clearSearch}
                                disabled={isLoading}
                            >
                                <FilterX className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select value={sortBy} onValueChange={(value: "name" | "recent" | "activity") => setSortBy(value)} disabled={isLoading}>
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Sort by..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="activity">Most Active</SelectItem>
                                <SelectItem value="recent">Most Recent</SelectItem>
                                <SelectItem value="name">Name</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols- lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {isLoading ? (
                        <div className="col-span-full text-center py-16 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-lg text-muted-foreground">Loading reports...</p>
                        </div>
                    ) : sortedReports.length > 0 ? (
                        sortedReports.map((report) => (
                            <Card className="h-[350px] flex flex-col gap-2 py-4" key={report.channelId}>
                                <CardHeader>
                                    <div className="flex justify-between gap-2 mb-1 items-center">
                                        {report.channelName && (
                                            <Badge variant="outline" className="px-1 py-0 h-5">
                                                {report.channelName}
                                            </Badge>
                                        )}
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
                                        <Link href={`/current-events/${report.channelId}/${convertTimestampToUnixTimestamp(report.timestamp)}`}>
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
                                                    <span className="font-medium">{report.messageCountLastHour}</span> update{report.messageCountLastHour === 1 ? '' : 's'} in the last hour
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardFooter>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-full text-center py-8">
                            <p className="text-lg text-muted-foreground">No reports found</p>
                            {searchQuery && (
                                <p className="text-sm text-muted-foreground mt-2">
                                    Try adjusting your search criteria or
                                    <Button variant="link" onClick={clearSearch} className="px-1 py-0">
                                        clear your search
                                    </Button>
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}