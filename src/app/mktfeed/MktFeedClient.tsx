'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import LocalDateTime from '@/components/utils/LocalDateTime';
import { MktNewsMessage } from '@/lib/types/core';
import { Clock, RefreshCw, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface MktFeedResponse {
    messages: MktNewsMessage[];
    stats: {
        totalMessages: number;
        lastUpdated: string | null;
    };
    timeframe: string;
    count: number;
}

export default function MktFeedClient() {
    const [data, setData] = useState<MktFeedResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState(2); // Default 2 hours

    const fetchData = useCallback(async (showRefreshLoader = false) => {
        if (showRefreshLoader) setIsRefreshing(true);
        else setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/mktnews?hours=${timeframe}`);
            if (!response.ok) {
                throw new Error('Failed to fetch market feed');
            }
            const result = await response.json();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [timeframe]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRefresh = () => {
        fetchData(true);
    };

    const timeframeOptions = [
        { value: 1, label: '1 Hour' },
        { value: 2, label: '2 Hours' },
        { value: 6, label: '6 Hours' },
        { value: 12, label: '12 Hours' },
        { value: 24, label: '24 Hours' },
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <Loader size="lg" />
                <p className="text-lg text-foreground">Loading market feed...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Feed</h2>
                    <p className="text-foreground mb-4">{error}</p>
                    <Button onClick={() => fetchData()} variant="outline">
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight md:text-4xl flex items-center gap-2">
                            <TrendingUp className="h-8 w-8 text-primary" />
                            Market Feed
                        </h1>
                        <p className="text-lg text-foreground mt-2">
                            Real-time market news and flash updates
                        </p>
                    </div>
                    <Button
                        onClick={handleRefresh}
                        variant="outline"
                        size="sm"
                        disabled={isRefreshing}
                        className="flex items-center gap-2"
                    >
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Timeframe:</span>
                        <div className="flex gap-2">
                            {timeframeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={timeframe === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTimeframe(option.value)}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-foreground">
                    <span className="flex items-center gap-1">
                        <Badge variant="secondary">{data?.count || 0} messages</Badge>
                        in last {timeframe}h
                    </span>
                    {data?.stats.lastUpdated && (
                        <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Last updated: <LocalDateTime dateString={data.stats.lastUpdated} />
                        </span>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="space-y-4">
                {data?.messages && data.messages.length > 0 ? (
                    data.messages.map((message, index) => (
                        <Card key={message.data.id} className="hover:shadow-md transition-shadow">
                            <CardHeader className="pb-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">
                                            #{index + 1}
                                        </Badge>
                                        {message.data.important === 1 && (
                                            <Badge variant="destructive" className="text-xs">
                                                Important
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-sm text-foreground">
                                        <LocalDateTime
                                            dateString={message.received_at}
                                            options={{
                                                dateStyle: 'short',
                                                timeStyle: 'medium'
                                            }}
                                        />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {message.data.data.title && (
                                        <CardTitle className="text-lg leading-relaxed">
                                            {message.data.data.title}
                                        </CardTitle>
                                    )}
                                    <p className="text-foreground leading-relaxed">
                                        {message.data.data.content}
                                    </p>
                                    {message.data.data.pic && (
                                        <div className="mt-3">
                                            <Image
                                                src={message.data.data.pic}
                                                alt="Market news"
                                                width={600}
                                                height={400}
                                                className="rounded-md max-w-full h-auto"
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <TrendingUp className="h-12 w-12 text-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">No market updates</h3>
                            <p className="text-foreground text-center">
                                No market news available for the selected timeframe.
                                <br />
                                Try selecting a longer time period or check back later.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
} 