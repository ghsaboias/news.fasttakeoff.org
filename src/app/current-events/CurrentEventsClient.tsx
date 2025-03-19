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
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { CloudflareEnv } from "../../../cloudflare-env.d";
export interface Props {
    channels: DiscordChannel[];
}

export default function CurrentEventsClient({ channels }: Props) {
    const context = getCloudflareContext() as unknown as { env: CloudflareEnv };
    const { env } = context;

    const [channelData, setChannelData] = useState<Map<string, { count: number; messages: DiscordMessage[]; loading: boolean }>>(
        new Map()
    );
    const [channelReports, setChannelReports] = useState<Map<string, { report: Report | null; loading: boolean; error: string | null }>>(
        new Map()
    );
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"position" | "name" | "recent">("position");
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
                channels: (DiscordChannel & { messageCount: number, messages: DiscordMessage[] })[],
                metadata: typeof metadata
            };
            setActiveChannels(data.channels);
            setMetadata(data.metadata);

            // Pre-populate channelData with the message counts and messages we already have
            const newChannelData = new Map(channelData);
            data.channels.forEach((channel: DiscordChannel & { messageCount: number, messages: DiscordMessage[] }) => {
                if (channel.messageCount > 0) {
                    newChannelData.set(channel.id, {
                        count: channel.messageCount,
                        messages: channel.messages || [],
                        loading: false
                    });
                }
            });
            setChannelData(newChannelData);
        } catch (error) {
            console.error('Error fetching active channels:', error);
            // Fallback to showing all channels
            setActiveChannels(channels);
        } finally {
            setIsLoading(false);
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

            // Cache the report
            const cacheKey = `report:${channel.id}`;
            const cacheValue = {
                report,
                timestamp: new Date().toISOString(),
                channelName: channel.name
            };

            // Store the report in the cache
            if (env.REPORTS_CACHE) {
                await env.REPORTS_CACHE.put(cacheKey, JSON.stringify(cacheValue), {
                    expirationTtl: 60 * 60 * 48 // 48 hours
                });
            }

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

    // Filter and sort channels
    const filteredChannels = activeChannels
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
                    const aData = channelData.get(a.id);
                    const bData = channelData.get(b.id);
                    if (!aData?.messages.length) return 1;
                    if (!bData?.messages.length) return -1;
                    return new Date(bData.messages[0].timestamp).getTime() -
                        new Date(aData.messages[0].timestamp).getTime();
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
                    <Select value={sortBy} onValueChange={(value: "position" | "name" | "recent") => setSortBy(value)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="position">Position</SelectItem>
                            <SelectItem value="name">Name</SelectItem>
                            <SelectItem value="recent">Most Recent</SelectItem>
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