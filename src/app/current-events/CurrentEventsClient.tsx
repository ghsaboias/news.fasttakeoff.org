// src/app/current-events/CurrentEventsClient.tsx
"use client";

import ChannelCard from "@/components/current-events/ChannelCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Report } from "@/lib/data/discord-reports";
import { DiscordChannel, DiscordMessage } from "@/lib/types/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

export interface Props {
    channels: DiscordChannel[];
}

export default function CurrentEventsClient({ channels }: Props) {
    const [channelData, setChannelData] = useState<Map<string, { count: number; messages: DiscordMessage[]; loading: boolean }>>(
        new Map()
    );
    const [channelReports, setChannelReports] = useState<Map<string, { report: Report | null; loading: boolean; error: string | null }>>(
        new Map()
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"position" | "name" | "recent" | "activity">("activity");
    const [isLoading, setIsLoading] = useState(true);
    const [activeChannels, setActiveChannels] = useState<DiscordChannel[]>([]);
    const [metadata, setMetadata] = useState<{
        totalChannels: number;
        activeChannels: number;
        timestamp: string;
    }>({
        totalChannels: channels.length,
        activeChannels: 0,
        timestamp: new Date().toISOString(),
    });

    async function fetchActiveChannels() {
        setIsLoading(true);
        try {
            const response = await fetch('/api/channels/active');
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

            const data = await response.json() as {
                channels: (DiscordChannel & { messageCounts: { "1h": number }, messages?: DiscordMessage[] })[],
                metadata: typeof metadata
            };
            setActiveChannels(data.channels);
            console.log(`[Client] Active channels loaded: ${data.channels.length}, total: ${channels.length}`);
            setMetadata(data.metadata);

            const newChannelData = new Map(channelData);
            data.channels.forEach((channel: DiscordChannel & { messageCounts: { "1h": number }, messages?: DiscordMessage[] }) => {
                if (channel.messageCounts["1h"] > 0) {
                    newChannelData.set(channel.id, {
                        count: channel.messageCounts["1h"],
                        messages: channel.messages || [],
                        loading: false
                    });
                }
            });
            setChannelData(newChannelData);

            await Promise.all(data.channels.map(channel => fetchChannelReport(channel.id)));
        } catch (error) {
            console.error('Error fetching active channels:', error);
            setActiveChannels(channels);
        } finally {
            setIsLoading(false);
        }
    }

    async function fetchChannelReport(channelId: string) {
        setChannelReports(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, {
                ...newMap.get(channelId) || { report: null, error: null },
                loading: true
            });
            return newMap;
        });

        try {
            const response = await fetch(`/api/reports?channelId=${channelId}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch report: ${response.status}`);
            }

            const report = await response.json() as Report;

            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, {
                    report,
                    loading: false,
                    error: null
                });
                return newMap;
            });
        } catch (error) {
            console.error(`[Client] Error fetching report for channel ${channelId}:`, error);
            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, {
                    report: null,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to fetch report'
                });
                return newMap;
            });
        }
    }

    useEffect(() => {
        fetchActiveChannels();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channels]);

    const fetchMessages = async (channelId: string) => {
        setChannelData(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, { ...newMap.get(channelId) || { count: 0, messages: [] }, loading: true });
            return newMap;
        });

        try {
            const response = await fetch(`/api/channels/${channelId}/messages`);
            if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
            const { count, messages } = await response.json() as { count: number, messages: DiscordMessage[] };

            setChannelData(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { count, messages, loading: false });
                return newMap;
            });
        } catch (error) {
            console.error(`[Client] Error fetching messages for channel ${channelId}:`, error);
            setChannelData(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { count: 0, messages: [], loading: false });
                return newMap;
            });
        }
    };

    const generateChannelReport = async (channel: DiscordChannel) => {
        setChannelReports(prev => {
            const newMap = new Map(prev);
            newMap.set(channel.id, { report: null, loading: true, error: null });
            return newMap;
        });

        try {
            console.log(`[Client] Sending POST to /api/reports with channelId: ${channel.id}`);
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channel.id, timeframe: '1h' }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Client] Fetch failed with status ${response.status}: ${errorText}`);
                throw new Error(`Failed to generate report: ${response.status} - ${errorText}`);
            }

            const { report } = await response.json() as { report: Report };
            console.log('[Client] Report received:', report);

            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channel.id, { report, loading: false, error: null });
                return newMap;
            });
        } catch (error) {
            console.error('[Client] Error generating report:', error);
            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channel.id, {
                    report: null,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to generate report',
                });
                return newMap;
            });
        }
    };

    // Filter and sort channels, excluding those with failed reports
    const filteredChannels = activeChannels
        .filter(channel => {
            const channelReport = channelReports.get(channel.id);
            // Exclude channels where the report fetch failed
            return !channelReport?.error;
        })
        .filter(channel =>
            channel.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortBy) {
                case "position":
                    return a.position - b.position;
                case "name":
                    return a.name.localeCompare(b.name);
                case "recent":
                    const aReport = channelReports.get(a.id)?.report;
                    const bReport = channelReports.get(b.id)?.report;

                    if (!aReport?.lastMessageTimestamp) return 1;
                    if (!bReport?.lastMessageTimestamp) return -1;

                    return new Date(bReport.lastMessageTimestamp).getTime() -
                        new Date(aReport.lastMessageTimestamp).getTime();
                case "activity":
                    const aData = channelData.get(a.id);
                    const bData = channelData.get(b.id);
                    return (bData?.count || 0) - (aData?.count || 0);
                default:
                    return 0;
            }
        });

    return (
        <div className="container mx-auto py-8">
            <div className="flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">Current Events</h1>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchActiveChannels}
                            disabled={isLoading}
                            className="ml-2"
                        >
                            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex gap-2">
                            <Badge variant="secondary">
                                Active Topics: {metadata.activeChannels}
                            </Badge>
                            <Badge variant="outline">
                                Total Topics: {metadata.totalChannels}
                            </Badge>
                        </div>
                        {metadata.timestamp && (
                            <span className="text-xs text-muted-foreground">
                                Last updated: {new Date(metadata.timestamp).toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex justify-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                )}

                {/* Search and Filter */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <Input
                        placeholder="Search channels..."
                        value={searchQuery}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                    />
                    <Select value={sortBy} onValueChange={(value: "position" | "name" | "recent" | "activity") => setSortBy(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="activity">Most Active</SelectItem>
                            <SelectItem value="recent">Most Recent</SelectItem>
                            <SelectItem value="position">Position</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Grid of Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredChannels.map(channel => (
                        <ChannelCard
                            key={channel.id}
                            channel={channel}
                            channelData={channelData}
                            channelReports={channelReports}
                            fetchMessages={fetchMessages}
                            generateChannelReport={generateChannelReport}
                        />
                    ))}
                </div>

                {/* No active topics message */}
                {!isLoading && filteredChannels.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-lg text-gray-500">No active topics found</p>
                        <p className="text-sm text-gray-400">Try again later or adjust your search criteria</p>
                    </div>
                )}
            </div>
        </div>
    );
}