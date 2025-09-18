'use client';

import ReactMarkdown from '@/components/ui/dynamic-markdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LocalDateTimeFull } from '@/components/utils/LocalDateTime';
import { BRAZIL_NEWS_TOPICS } from '@/lib/config';
import { useApi } from '@/lib/hooks';
import { SummaryResult } from '@/lib/types/feeds';
import { useEffect, useState } from 'react';

// Helper function to convert bullet points in text to proper markdown list items
function formatTextWithBulletPoints(text: string): string {
    return text.split('\n').map(line => {
        if (line.trim().startsWith('•')) {
            // Convert bullet point lines to proper markdown list items
            return line.trim().replace('•', '-');
        }
        return line;
    }).join('\n');
}

interface SummaryOption {
    key: string;
    createdAt: string;
}

const fetchSummaryOptions = async (topicId?: string): Promise<SummaryOption[]> => {
    const url = topicId ? `/api/summaries/list?topic=${topicId}` : '/api/summaries/list';
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch summary options');
    }
    return response.json();
};

const fetchSummary = async (selectedKey: string, topicId?: string): Promise<SummaryResult> => {
    const endpoint = selectedKey === 'current'
        ? (topicId ? `/api/summarize?topic=${topicId}` : '/api/summarize?combine=true')
        : `/api/summaries/${encodeURIComponent(selectedKey)}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to fetch summary');
    }
    return response.json();
};

export default function SummaryDisplay() {
    const [selectedKey, setSelectedKey] = useState<string>('current');
    const [activeTopic, setActiveTopic] = useState<keyof typeof BRAZIL_NEWS_TOPICS>('geral');

    const { data: summaryOptions = [] } = useApi<SummaryOption[]>(
        () => fetchSummaryOptions(activeTopic),
    );

    const { data: result, loading, error, request: requestSummary } = useApi<SummaryResult>(
        () => fetchSummary(selectedKey, activeTopic),
        { manual: true }
    );

    useEffect(() => {
        requestSummary();
    }, [selectedKey, activeTopic, requestSummary]);

    // Reset selectedKey when topic changes
    useEffect(() => {
        setSelectedKey('current');
    }, [activeTopic]);

    // --- Always show toggles ---
    return (
        <div className="my-4 w-full max-w-4xl">
            {/* Topic Selection */}
            <Tabs value={activeTopic} onValueChange={value => setActiveTopic(value as keyof typeof BRAZIL_NEWS_TOPICS)} className="w-full mb-6">
                <TabsList className="grid w-full grid-cols-2">
                    {Object.entries(BRAZIL_NEWS_TOPICS).map(([key, topic]) => (
                        <TabsTrigger key={key} value={key}>
                            {topic.name}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            {/* Summary Selection */}
            <div className="mb-6">
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a summary">
                            {selectedKey === 'current' ? 'Resumo Atual' : (
                                <LocalDateTimeFull
                                    dateString={summaryOptions?.find(opt => opt.key === selectedKey)?.createdAt || ''}
                                    options={{
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }}
                                />
                            )}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="current">Resumo Atual</SelectItem>
                        {summaryOptions && summaryOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                                <LocalDateTimeFull
                                    dateString={option.createdAt}
                                    options={{
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    }}
                                />
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {/* --- Content area: loader, error, or summary --- */}
            {loading ? (
                <div className="space-y-6 py-12">
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-48" />
                        <Skeleton className="h-4 w-96" />
                    </div>
                    <div className="space-y-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? 'w-full' : i % 3 === 1 ? 'w-5/6' : 'w-4/5'}`} />
                        ))}
                    </div>
                </div>
            ) : error ? (() => {
                const errorMessage = error.message || 'An error occurred';
                const isNoCacheError = errorMessage.includes('No cached summary available');
                if (isNoCacheError) {
                    return (
                        <div className="min-h-[40vh] flex items-center justify-center p-4">
                            <div className="max-w-md w-full text-center">
                                <div className="mb-6">
                                    <div className="text-6xl mb-4">⏳</div>
                                    <h2 className="text-2xl font-bold mb-2">Summary in Progress</h2>
                                    <p className="text-foreground">
                                        We&apos;re generating the latest Brazil news summary for you.
                                    </p>
                                </div>
                                <div className="space-y-3 text-sm text-foreground">
                                    <p>
                                        Fresh summaries are automatically created every hour with the latest news from Brazilian sources.
                                    </p>
                                    <p>
                                        Please check back in a few minutes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="bg-red-900/50 border border-red-500 rounded p-4 mt-4">
                        <p className="text-red-500">{errorMessage}</p>
                    </div>
                );
            })() : !result ? null : (
                <div className="prose prose-invert max-w-none">
                    <ReactMarkdown
                        components={{
                            p: ({ ...props }) => {
                                // Check if this paragraph contains only a strong element with a heading
                                const children = props.children as React.ReactNode[];
                                if (Array.isArray(children) && children.length > 0) {
                                    const firstChild = children[0];
                                    if (firstChild &&
                                        typeof firstChild === 'object' &&
                                        'type' in firstChild &&
                                        firstChild.type === 'strong' &&
                                        'props' in firstChild &&
                                        firstChild.props &&
                                        typeof firstChild.props === 'object') {
                                        const strongProps = firstChild.props as { children?: React.ReactNode };
                                        if (strongProps.children) {
                                            const content = String(strongProps.children);
                                            if ([
                                                'Key Points', 'Summary', 'Highlights'
                                            ].includes(content)) {
                                                return null;
                                            }
                                        }
                                    }
                                }
                                // Don't wrap list items in paragraphs
                                const content = props.children?.toString() || '';
                                if (content.trim().startsWith('-')) {
                                    return <>{props.children}</>;
                                }
                                return <p className="leading-relaxed" {...props} />;
                            },
                            strong: ({ ...props }) => {
                                // Check if this is a standalone strong element that's likely a heading
                                const content = props.children?.toString() || '';
                                const isHeading = content && ['Key Points', 'Summary', 'Highlights'].includes(content);
                                return isHeading ?
                                    <strong className="block text-xl font-bold mb-3" {...props} /> :
                                    <strong className="font-semibold" {...props} />;
                            },
                            // Enhanced list styling
                            ul: ({ ...props }) => (
                                <ul className="space-y-4 my-4" {...props} />
                            ),
                            ol: ({ ...props }) => (
                                <ol className="list-decimal pl-6 space-y-4 my-4" {...props} />
                            ),
                            li: ({ ...props }) => (
                                <li className="flex gap-2">
                                    <span className="card-text">•</span>
                                    <span>{props.children}</span>
                                </li>
                            ),
                            // Add blockquote styling
                            blockquote: ({ ...props }) => (
                                <blockquote className="border-l-2 border-foreground pl-4 my-4 italic" {...props} />
                            ),
                            // Add heading styles
                            h1: ({ ...props }) => (
                                <h1 className="text-2xl font-bold mb-4" {...props} />
                            ),
                            h2: ({ ...props }) => (
                                <h2 className="text-xl font-bold mt-6 mb-3" {...props} />
                            ),
                            h3: ({ ...props }) => (
                                <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />
                            )
                        }}
                    >
                        {formatTextWithBulletPoints(result.summary)}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
} 