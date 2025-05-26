'use client';

import { Loader } from '@/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SummaryResult } from '@/lib/types/core';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

// Helper function to format date
function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

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

export function SummaryDisplay() {
    const [result, setResult] = useState<SummaryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summaryOptions, setSummaryOptions] = useState<SummaryOption[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>('current');

    useEffect(() => {
        async function fetchSummaryOptions() {
            try {
                const response = await fetch('/api/summaries/list');
                if (!response.ok) {
                    throw new Error('Failed to fetch summary options');
                }
                const data = await response.json();
                console.log('data', data);
                setSummaryOptions(data);
            } catch (err) {
                console.error('Failed to fetch summary options:', err);
            }
        }

        fetchSummaryOptions();
    }, []);

    useEffect(() => {
        async function fetchSummary() {
            try {
                setLoading(true);
                setError(null);

                const endpoint = selectedKey === 'current'
                    ? '/api/summarize?combine=true'
                    : `/api/summaries/${encodeURIComponent(selectedKey)}`;

                const response = await fetch(endpoint);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to fetch summary');
                }

                const data = await response.json();
                setResult(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        }

        fetchSummary();
    }, [selectedKey]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader size="lg" />
            </div>
        );
    }

    if (error) {
        const isNoCacheError = error.includes('No cached summary available');

        if (isNoCacheError) {
            return (
                <div className="min-h-[60vh] flex items-center justify-center p-4">
                    <div className="max-w-md w-full text-center">
                        <div className="mb-6">
                            <div className="text-6xl mb-4">⏳</div>
                            <h2 className="text-2xl font-bold mb-2">Summary in Progress</h2>
                            <p className="text-muted-foreground">
                                We&apos;re generating the latest Brazil news summary for you.
                            </p>
                        </div>
                        <div className="space-y-3 text-sm text-muted-foreground">
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
                <p className="text-red-500">{error}</p>
            </div>
        );
    }

    if (!result) {
        return null;
    }

    const formattedSummary = formatTextWithBulletPoints(result.summary);

    return (
        <div className="my-4">
            {/* Summary Selection */}
            <div className="mb-6">
                <Select value={selectedKey} onValueChange={setSelectedKey}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a summary">
                            {selectedKey === 'current' ? 'Current Summary' : formatDate(summaryOptions.find(opt => opt.key === selectedKey)?.createdAt || '')}
                        </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="current">Current Summary</SelectItem>
                        {summaryOptions.map((option) => (
                            <SelectItem key={option.key} value={option.key}>
                                {formatDate(option.createdAt)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Content */}
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
                                        if (['Key Points', 'Summary', 'Highlights'].includes(content)) {
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

                            return <p className="my-2 leading-relaxed" {...props} />;
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
                                <span className="text-muted-foreground">•</span>
                                <span>{props.children}</span>
                            </li>
                        ),
                        // Add blockquote styling
                        blockquote: ({ ...props }) => (
                            <blockquote className="border-l-2 border-muted-foreground pl-4 my-4 italic" {...props} />
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
                    {formattedSummary}
                </ReactMarkdown>
            </div>
        </div>
    );
} 