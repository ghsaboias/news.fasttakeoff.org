// src/app/current-events/CurrentEventsClient.tsx
"use client";

import ChannelCard from "@/components/current-events/ChannelCard";
import { Badge } from "@/components/ui/badge";
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
import { useState } from "react";

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
    const [sortBy, setSortBy] = useState<"position" | "name" | "recent">("position");

    const fetchMessages = async (channelId: string) => {
        setChannelData(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, { ...newMap.get(channelId) || { count: 0, messages: [] }, loading: true });
            return newMap;
        });

        try {
            const response = await fetch(`/api/channels/${channelId}/messages`);
            if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
            const { count, messages } = await response.json();

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

    const generateChannelReport = async (channelId: string) => {
        setChannelReports(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, { report: null, loading: true, error: null });
            return newMap;
        });

        try {
            console.log(`[Client] Sending POST to /api/reports with channelId: ${channelId}`);
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, timeframe: '1h' }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Client] Fetch failed with status ${response.status}: ${errorText}`);
                throw new Error(`Failed to generate report: ${response.status} - ${errorText}`);
            }

            const { report } = await response.json();
            console.log('[Client] Report received:', report);

            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { report, loading: false, error: null });
                return newMap;
            });
        } catch (error) {
            console.error('[Client] Error generating report:', error);
            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, {
                    report: null,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to generate report',
                });
                return newMap;
            });
        }
    };

    // Filter and sort channels
    const filteredChannels = channels
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
                    <h1 className="text-2xl font-bold">Current Events</h1>
                    <Badge variant="secondary">
                        Total Channels: {channels.length}
                    </Badge>
                </div>

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
            </div>
        </div>
    );
}