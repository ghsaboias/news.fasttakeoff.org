'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from '@/components/ui/dynamic-markdown';
import { Loader } from '@/components/ui/loader';
import LocalDateTime from '@/components/utils/LocalDateTime';
import { useApi } from '@/lib/hooks';
import { MktNewsMessage, MktNewsSummary } from '@/lib/types/core';
import { Clock, RefreshCw, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// Format market news text by handling common patterns
function formatMarketText(text: string): React.ReactNode {
    // Handle <B>, <b>, and <br> tags within the text
    const parts = text.split(/(<\/?[Bb]>|<br\s*\/?>)/i);
    const result: React.ReactNode[] = [];
    let isBold = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part === '<B>' || part === '<b>') {
            isBold = true;
        } else if (part === '</B>' || part === '</b>') {
            isBold = false;
        } else if (/^<br\s*\/?>$/i.test(part)) {
            // Handle <br>, <br/>, <br /> tags
            result.push(<br key={i} />);
        } else if (part) {
            // Only add non-empty parts
            if (isBold) {
                result.push(<strong key={i}>{part}</strong>);
            } else {
                result.push(part);
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

interface SummaryResponse {
    summary: MktNewsSummary | null;
}

const timeframeOptions = [
    { value: 1, label: '1H' },
    { value: 2, label: '2H' },
    { value: 6, label: '6H' },
    { value: 12, label: '12H' },
    { value: 24, label: '24H' },
];

export default function MktFeedClient() {
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

    // Fetch latest 15min summary once on mount and refresh on demand
    const fetchSummary = useCallback(async () => {
        const res = await fetch('/api/mktnews/summary');
        if (!res.ok) throw new Error('Failed to fetch summary');
        return res.json();
    }, []);

    const { data: summaryData, loading: summaryLoading, error: summaryError, request: requestSummary } =
        useApi<SummaryResponse>(fetchSummary, { manual: true });

    useEffect(() => {
        requestSummary();
    }, [requestSummary]);

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
            {/* Market Flash Summary */}
            {summaryError && (
                <Card className="mb-4 p-4 border-destructive/50">
                    <CardTitle className="text-destructive text-sm">Failed to load summary</CardTitle>
                </Card>
            )}
            {summaryLoading && (
                <div className="mb-4 flex items-center gap-2 text-sm text-foreground/80">
                    <Loader size="sm" /> Loading market summary...
                </div>
            )}
            {summaryData?.summary && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold flex items-center gap-2 text-primary">
                            <TrendingUp className="h-5 w-5" /> Market Flash Summary (15m)
                        </CardTitle>
                        <p className="text-xs text-foreground">
                            Generated <LocalDateTime dateString={summaryData.summary.generatedAt} /> from {summaryData.summary.messageCount} messages
                        </p>
                    </CardHeader>
                    <CardContent className="prose max-w-none">
                        <ReactMarkdown
                            components={{
                                p: ({ ...props }) => {
                                    // Don't wrap list items in paragraphs
                                    const content = props.children?.toString() || '';
                                    if (content.trim().startsWith('-')) {
                                        return <>{props.children}</>;
                                    }
                                    return <p className="leading-relaxed mb-3" {...props} />;
                                },
                                strong: ({ ...props }) => {
                                    // Check if this is a standalone strong element that's likely a section heading
                                    const content = props.children?.toString() || '';
                                    const isHeading = content && [
                                        'Market Flash Summary', 'US Stocks', 'Trump Administration', 'Digital Assets',
                                        'Ukraine Peace', 'Elon Musk', 'US-EU Trade', 'US Treasury', 'Fed Reverse',
                                        'Syria-Saudi', 'Corporate Actions', 'US Politics', 'Copper Tariffs', 'US Dept'
                                    ].some(heading => content.includes(heading.split(' ')[0]));

                                    return isHeading ?
                                        <strong className="block text-lg font-bold first:mt-0" {...props} /> :
                                        <strong className="font-semibold" {...props} />;
                                },
                                // Enhanced list styling
                                ul: ({ ...props }) => (
                                    <ul className="space-y-4 my-4" {...props} />
                                ),
                                ol: ({ ...props }) => (
                                    <ol className="list-decimal pl-6" {...props} />
                                ),
                                li: ({ ...props }) => (
                                    <li className="flex gap-2 leading-relaxed">
                                        <span className="text-foreground">•</span>
                                        <span className="flex-1">{props.children}</span>
                                    </li>
                                ),
                                // Add heading styles for any markdown headings
                                h1: ({ ...props }) => (
                                    <h1 className="text-2xl font-bold first:mt-0 text-foreground" {...props} />
                                ),
                                h2: ({ ...props }) => (
                                    <h2 className="text-xl font-bold first:mt-0 text-foreground mb-4" {...props} />
                                ),
                                h3: ({ ...props }) => (
                                    <h3 className="text-lg font-semibold first:mt-0" {...props} />
                                ),
                                // Add blockquote styling
                                blockquote: ({ ...props }) => (
                                    <blockquote className="border-l-2 border-primary pl-4 my-3 italic" {...props} />
                                )
                            }}
                        >
                            {summaryData.summary.summary}
                        </ReactMarkdown>
                    </CardContent>
                </Card>
            )}
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
                                        {formatMarketText(message.data.data.content || '')}
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