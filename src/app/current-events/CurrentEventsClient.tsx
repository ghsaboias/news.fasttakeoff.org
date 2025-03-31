"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { DiscordChannel } from "@/lib/types/core";
import { FilterX, Search } from "lucide-react";
import { useState } from "react";

export interface Props {
    channels: DiscordChannel[];
}

export default function CurrentEventsClient({ channels }: Props) {
    console.log(channels);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"position" | "name" | "recent" | "activity">("activity");
    // const [isLoading, setIsLoading] = useState(false);
    // const [metadata, setMetadata] = useState<{
    //     totalChannels: number;
    //     activeChannels: number;
    //     timestamp: string;
    // }>({
    //     totalChannels: channels.length,
    //     activeChannels: 0,
    //     timestamp: new Date().toISOString(),
    // });

    const clearSearch = () => setSearchQuery("");
    // const reportCount = channels.filter(channel => {
    //     const report = channelReports.get(channel.id)?.report;
    //     return report && !channelReports.get(channel.id)?.error;
    // }).length;

    return (
        <div className="py-8 px-4">
            <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold">Current Events</h1>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        {/* <div className="flex gap-2">
                            <Badge variant="secondary">
                                Active Topics: {metadata.activeChannels}
                            </Badge>
                            <Badge variant="outline">
                                With Reports: {reportCount}
                            </Badge>
                        </div> */}
                        {/* {metadata.timestamp && (
                            <span className="text-xs text-muted-foreground">
                                Last updated: {new Date(metadata.timestamp).toISOString().substring(11, 19)}
                            </span>
                        )} */}
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
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-9 px-2"
                                onClick={clearSearch}
                            >
                                <FilterX className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Select value={sortBy} onValueChange={(value: "position" | "name" | "recent" | "activity") => setSortBy(value)}>
                            <SelectTrigger className="w-[150px]">
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
                </div>
                {/* <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredChannels.map(channel => (
                        <ChannelCard
                            key={channel.id}
                            channel={channel}
                            channelData={channelData}
                            channelReports={channelReports}
                            isLoading={isLoading}
                        />
                    ))}
                </div>
                {!isLoading && filteredChannels.length === 0 && (
                    <div className="text-center py-8">
                        <p className="text-lg text-gray-500">No active topics found</p>
                        {searchQuery && (
                            <p className="text-sm text-gray-400 mt-2">
                                Try adjusting your search criteria or
                                <Button variant="link" onClick={clearSearch} className="px-1 py-0">
                                    clear your search
                                </Button>
                            </p>
                        )}
                    </div>
                )} */}
            </div>
        </div>
    );
}