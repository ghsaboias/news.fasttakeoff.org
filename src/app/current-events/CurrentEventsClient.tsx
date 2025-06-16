"use client";

import ReportCard from "@/components/current-events/ReportCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Report } from "@/lib/types/core";
import { FilterX, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export interface Props {
    reports: Report[];
    isLoading?: boolean;
}

export default function CurrentEventsClient({ reports, isLoading = false }: Props) {
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "recent" | "activity">("recent");
    const [reportData, setReportData] = useState<Report[]>(reports);
    const [loading, setLoading] = useState(isLoading);

    useEffect(() => {
        setReportData(reports);
        setLoading(false);
    }, [reports]);

    // Client-side fallback when server-side data is empty
    useEffect(() => {
        if (reports.length === 0 && !loading && reportData.length === 0) {
            setLoading(true);

            fetch('/api/reports?limit=100')
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    setReportData(data || []);
                })
                .catch(error => {
                    console.error('Error fetching reports client-side:', error);
                    setReportData([]);
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    }, [reports.length, loading, reportData.length]);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
    };

    const handleSortChange = (value: "name" | "recent" | "activity") => {
        setSortBy(value);
    }

    const clearSearch = () => {
        setSearchQuery("");
    }

    // Memoize filtered reports based on search query
    const filteredReports = useMemo(() => {
        if (!searchQuery.trim()) {
            return reportData;
        }

        const lowerCaseQuery = searchQuery.toLowerCase();
        const filtered = reportData.filter(report =>
            (report.channelName?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (report.headline?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (report.city?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (report.body?.toLowerCase() || '').includes(lowerCaseQuery)
        );
        return filtered;
    }, [reportData, searchQuery]);

    // Memoize sorted reports based on filtered reports and sort criteria
    const sortedReports = useMemo(() => {
        const sorted = [...filteredReports].sort((a, b) => {
            switch (sortBy) {
                case "activity":
                    return (b.messageCount || 0) - (a.messageCount || 0);
                case "recent":
                    return new Date(b.generatedAt || 0).getTime() - new Date(a.generatedAt || 0).getTime();
                case "name":
                    return (a.channelName || "").localeCompare(b.channelName || "");
                default:
                    return 0;
            }
        });
        return sorted;
    }, [filteredReports, sortBy]);

    const channelsWithLatest = useMemo(() => {
        // Since sortedReports is already sorted, the first report per channel is the latest
        const channelMap = new Map<string, { latest: Report; count: number }>();

        sortedReports.forEach(report => {
            const channel = report.channelName || 'Uncategorized';
            if (!channelMap.has(channel)) {
                channelMap.set(channel, { latest: report, count: 1 });
            } else {
                channelMap.get(channel)!.count++;
            }
        });

        const entries = Array.from(channelMap.entries()).map(([channel, data]) => ({
            channel,
            latestReport: data.latest,
            reportCount: data.count
        }));

        switch (sortBy) {
            case "activity":
                return entries.sort((a, b) => b.reportCount - a.reportCount);
            case "name":
                return entries.sort((a, b) => a.channel.localeCompare(b.channel));
            case "recent":
            default:
                return entries.sort(
                    (a, b) => new Date(b.latestReport.generatedAt).getTime() - new Date(a.latestReport.generatedAt).getTime()
                );
        }
    }, [sortedReports, sortBy]);

    const lastUpdated = reportData.length > 0 ? reportData[0]?.generatedAt : null;

    return (
        <div className="flex flex-col gap-6 py-8">
            <div className="flex flex-col gap-4 flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">Current Events</h1>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <div className="flex gap-2">
                        <Badge variant="secondary">
                            Active Topics: {loading ? "Loading..." : channelsWithLatest.length}
                        </Badge>
                    </div>
                    {lastUpdated && !loading && (
                        <span className="text-xs text-foreground">
                            Last updated: {new Date(lastUpdated).toISOString().substring(11, 19)}
                        </span>
                    )}
                </div>
            </div>
            <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
                <div className="relative w-full px-6">
                    <Search className="absolute left-8 top-2.5 h-4 w-4 card-text" />
                    <Input
                        placeholder="Search topics..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        className="pl-8 pr-8 max-w-sm"
                        disabled={loading}
                    />
                    {searchQuery && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-9 px-2"
                            onClick={clearSearch}
                            disabled={loading}
                        >
                            <FilterX className="h-4 w-4" />
                        </Button>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    <Select value={sortBy} onValueChange={handleSortChange} disabled={loading}>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-16 flex flex-col items-center justify-center gap-4">
                        <Loader size="lg" />
                        <p className="text-lg text-muted-foreground">Loading reports...</p>
                    </div>
                ) : channelsWithLatest.length > 0 ? (
                    channelsWithLatest.map(({ channel, latestReport }) => (
                        <ReportCard
                            report={latestReport}
                            clickableChannel={false}
                        />
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
        </div >
    );
}