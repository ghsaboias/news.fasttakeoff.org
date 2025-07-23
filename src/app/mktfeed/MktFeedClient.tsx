'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader } from '@/components/ui/loader';
import LocalDateTime from '@/components/utils/LocalDateTime';
import { useApi } from '@/lib/hooks';
import { MktNewsMessage } from '@/lib/types/core';
import { Clock, RefreshCw, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Format market news text by handling common patterns
function formatMarketText(text: string): React.ReactNode {
    // Handle <B> and <b> tags within the text
    const parts = text.split(/(<\/?[Bb]>)/);
    const result: React.ReactNode[] = [];
    let isBold = false;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part === '<B>' || part === '<b>') {
            isBold = true;
        } else if (part === '</B>' || part === '</b>') {
            isBold = false;
        } else if (part) {
            // Handle line breaks within the text part
            const textWithBreaks = part.split('\n').map((line, lineIndex, array) => {
                if (lineIndex === array.length - 1) {
                    // Last line, don't add break after it
                    return line;
                } else {
                    // Add line break after each line except the last
                    return [line, <br key={`${i}-br-${lineIndex}`} />];
                }
            }).flat();
            
            // Only add non-empty parts
            if (isBold) {
                result.push(<strong key={i}>{textWithBreaks}</strong>);
            } else {
                result.push(...textWithBreaks.map((item, idx) => 
                    typeof item === 'string' ? item : React.cloneElement(item, { key: `${i}-${idx}` })
                ));
            }
        }
    }
    
    return result.length > 0 ? result : text;
}

interface MktFeedResponse {
    messages: MktNewsMessage[];
    stats: {
        totalMessages: number;
        lastUpdated: string | null;
    };
    timeframe: string;
    count: number;
}

const timeframeOptions = [
    { value: 1, label: '1H' },
    { value: 2, label: '2H' },
    { value: 6, label: '6H' },
    { value: 12, label: '12H' },
    { value: 24, label: '24H' },
];

export function MktFeedClient() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const initialTimeframe = parseInt(searchParams.get('hours') || '2', 10);
    const [timeframe, setTimeframe] = useState(initialTimeframe);

    const fetchData = useCallback(async () => {
        const response = await fetch(`/api/mktnews?hours=${timeframe}`);
        if (!response.ok) {
            throw new Error('Failed to fetch market feed');
        }
        return response.json();
    }, [timeframe]);

    const { data, loading, error, request } = useApi<MktFeedResponse>(fetchData, {
        manual: true,
    });

    useEffect(() => {
        request();
    }, [request]);

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('hours', timeframe.toString());
        router.push(`?hours=${timeframe}`, { scroll: false });
        request();
    }, [timeframe, router, searchParams, request]);


    const handleRefresh = async () => {
        await request();
    };

    if (loading && !data) {
        return (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
                <Loader size="lg" />
                <p className="text-lg text-foreground">Loading market feed...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center">
                <Card className="p-6">
                    <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Feed</h2>
                    <p className="text-foreground mb-4">{error.message}</p>
                    <Button onClick={handleRefresh} variant="outline">
                        Try Again
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 max-w-5xl">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className='flex-shrink-0'>
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <TrendingUp className="h-8 w-8 text-primary" />
                            Market Feed
                        </h1>
                        <p className="text-md text-foreground mt-1">
                            Real-time market news and flash updates.
                        </p>
                    </div>
                    <div className="whitespace-nowrap w-full md:w-auto">
                        <div className="flex items-center gap-1 flex-nowrap md:max-w-[400px]">
                            {timeframeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    variant={timeframe === option.value ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setTimeframe(option.value)}
                                    className="flex-1 min-w-0 px-2 max-w-[80px]"
                                >
                                    {option.label}
                                </Button>
                            ))}
                            <Button
                                onClick={handleRefresh}
                                variant="outline"
                                size="sm"
                                disabled={loading}
                                className="flex items-center gap-1 min-w-0 px-2 max-w-[100px]"
                            >
                                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                <span className="hidden sm:inline">Refresh</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-foreground border-t border-border pt-2">
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
            <div className="space-y-2">
                {data?.messages && data.messages.length > 0 ? (
                    data.messages.map((message: MktNewsMessage, index: number) => (
                        <Card key={message.data.id} className="hover:shadow-md transition-shadow gap-2">
                            <CardHeader className="p-2">
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
                            <CardContent className="p-2">
                                <div className="space-y-2">
                                    {message.data.data.title && (
                                        <CardTitle className="text-lg leading-relaxed">
                                            {message.data.data.title}
                                        </CardTitle>
                                    )}
                                    <p className="text-foreground leading-relaxed">
                                        {formatMarketText(message.data.data.content)}
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
                    <Card className="w-full">
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