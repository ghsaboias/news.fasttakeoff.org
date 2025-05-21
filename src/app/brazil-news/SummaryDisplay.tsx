'use client';

import { SummaryResult } from '@/lib/types/core';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

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

export function SummaryDisplay() {
    const [result, setResult] = useState<SummaryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSummary() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/summarize?combine=true');
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
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
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