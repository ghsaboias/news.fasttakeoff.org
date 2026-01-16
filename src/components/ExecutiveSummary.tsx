'use client';

import ReactMarkdown from '@/components/ui/dynamic-markdown';
import { fetcherWithMessages } from '@/lib/fetcher';
import { ExecutiveSummary as ExecutiveSummaryType } from '@/lib/types/reports';
import React, { useMemo } from 'react';
import useSWR from 'swr';

interface ExecutiveSummaryProps {
    className?: string;
    initialSummary?: ExecutiveSummaryType | null;
}

// Helper to split mini summary into sections
function parseMiniSummarySections(miniSummary: string) {
    // Split on '## ' but keep the heading
    const rawSections = miniSummary.split(/(^## .*)/m).filter(Boolean);
    const sections: { heading: string; content: string }[] = [];
    for (let i = 0; i < rawSections.length; i++) {
        if (rawSections[i].startsWith('## ')) {
            const heading = rawSections[i].trim();
            const content = rawSections[i + 1]?.trim() || '';
            sections.push({ heading, content });
            i++; // skip content
        }
    }
    return sections;
}

// Helper to split main summary into sections (ignoring the first # Executive Summary heading)
function parseMainSummarySections(summary: string) {
    // The AI prompt specifically instructs not to include a title, so we don't need to remove anything
    // Just split on '## ' but keep the heading
    const rawSections = summary.split(/(^## .*)/m).filter(Boolean);
    const sections: { heading: string; content: string }[] = [];
    for (let i = 0; i < rawSections.length; i++) {
        if (rawSections[i].startsWith('## ')) {
            const heading = rawSections[i].trim();
            const content = rawSections[i + 1]?.trim() || '';
            sections.push({ heading, content });
            i++; // skip content
        }
    }
    return sections;
}

const fetcher = fetcherWithMessages({
    404: 'No executive summary available yet. Check back later.',
});

function ExecutiveSummary({ className = '', initialSummary }: ExecutiveSummaryProps) {
    // SWR with SSR fallback data - no loading flash, optional background revalidation
    const { data: summary, error, isLoading, mutate } = useSWR<ExecutiveSummaryType>(
        '/api/executive-summary',
        fetcher,
        {
            fallbackData: initialSummary ?? undefined,
            revalidateOnMount: !initialSummary,  // Only fetch if no SSR data
            revalidateOnFocus: false,            // Don't refetch on tab focus
        }
    );

    // Memoize mini summary sections
    const miniSummaryContent = useMemo(() => {
        if (!summary?.miniSummary) return null;
        
        const sections = parseMiniSummarySections(summary.miniSummary);
        let rows: { sections: { heading: string; content: string }[] }[] = [];
        if (sections.length <= 3) {
            rows = [{ sections }];
        } else if (sections.length === 4) {
            rows = [
                { sections: sections.slice(0, 2) },
                { sections: sections.slice(2, 4) },
            ];
        } else if (sections.length === 5) {
            rows = [
                { sections: sections.slice(0, 3) },
                { sections: sections.slice(3, 5) },
            ];
        }
        return (
            <div className="p-4 border-b border-dark-600 bg-dark-800">
                <div className="flex flex-col gap-6">
                    {rows.map((row, rowIdx) => (
                        <div
                            key={rowIdx}
                            className={`flex flex-row flex-wrap gap-2 justify-center`}
                        >
                            {row.sections.map((section, colIdx) => (
                                <div
                                    key={colIdx}
                                    className={`flex-1 min-w-[260px] max-w-md bg-dark-700 rounded shadow-dark p-4 m-2 border border-dark-600`}
                                >
                                    <ReactMarkdown
                                        components={{
                                            h2: ({ children }) => <h2 className="text-2xl font-bold text-dark-100 mb-2 text-center">{children}</h2>,
                                            ul: ({ children }) => <ul className="space-y-2 mb-4 ml-4">{children}</ul>,
                                            li: ({ children }) => <li className="mb-1 text-md text-dark-300">{children}</li>,
                                            strong: ({ children }) => <strong className="font-semibold text-accent">{children}</strong>,
                                            p: ({ children }) => <p className="mb-4 text-dark-300">{children}</p>,
                                        }}
                                    >
                                        {`${section.heading}\n\n${section.content}`}
                                    </ReactMarkdown>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }, [summary?.miniSummary]);

    // Memoize main summary sections
    const mainSummaryContent = useMemo(() => {
        if (!summary?.summary) return null;
        
        const sections = parseMainSummarySections(summary.summary);
        let rows: { sections: { heading: string; content: string }[] }[] = [];
        if (sections.length <= 3) {
            rows = [{ sections }];
        } else if (sections.length === 4) {
            rows = [
                { sections: sections.slice(0, 2) },
                { sections: sections.slice(2, 4) },
            ];
        } else if (sections.length === 5) {
            rows = [
                { sections: sections.slice(0, 3) },
                { sections: sections.slice(3, 5) },
            ];
        } else {
            // Handle any number of sections > 5 by chunking into rows of 3
            for (let i = 0; i < sections.length; i += 3) {
                rows.push({ sections: sections.slice(i, i + 3) });
            }
        }
        return (
            <div className="flex flex-col gap-6">
                {rows.map((row, rowIdx) => (
                    <div
                        key={rowIdx}
                        className={`flex flex-row flex-wrap gap-4 justify-center`}
                    >
                        {row.sections.map((section, colIdx) => (
                            <div
                                key={colIdx}
                                className={`flex-1 min-w-[260px] max-w-md bg-dark-800 rounded shadow-dark p-4 border border-dark-600`}
                            >
                                <ReactMarkdown
                                    components={{
                                        h2: ({ children }) => <h2 className="text-2xl font-bold text-dark-100 mb-4 text-center">{children}</h2>,
                                        ul: ({ children }) => <ul className="mb-4 ml-4">{children}</ul>,
                                        li: ({ children }) => <li className="my-4 text-dark-300">{children}</li>,
                                        strong: ({ children }) => <strong className="font-semibold text-accent">{children}</strong>,
                                        p: ({ children }) => <p className="mb-4 text-dark-300">{children}</p>,
                                    }}
                                >
                                    {`${section.heading}\n\n${section.content}`}
                                </ReactMarkdown>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }, [summary?.summary]);

    if (isLoading && !summary) {
        return (
            <div className={`bg-dark-800 shadow-dark p-6 ${className}`}>
                <div className="animate-pulse">
                    <div className="h-6 bg-dark-600 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-dark-600 rounded w-full mb-2"></div>
                    <div className="h-4 bg-dark-600 rounded w-5/6 mb-2"></div>
                    <div className="h-4 bg-dark-600 rounded w-4/6 mb-2"></div>
                    <div className="h-4 bg-dark-600 rounded w-3/6"></div>
                </div>
            </div>
        );
    }

    if (error && !summary) {
        return (
            <div className={`bg-dark-800 shadow-dark p-6 ${className}`}>
                <div className="text-center">
                    <div className="text-dark-400 mb-4">
                        <svg className="mx-auto h-12 w-12 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-dark-100 mb-2">No Summary Available</h3>
                    <p className="text-dark-400 mb-4">{error.message}</p>
                    <button
                        onClick={() => mutate()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-industrial-gradient hover:shadow-industrial focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-industrial-500"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    if (!summary) {
        return null;
    }

    return (
        <div className={`shadow-dark ${className}`}>
            {/* Header */}
            <div className="bg-industrial-gradient px-6 py-2">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-foreground font-bold text-sm">
                            Last {summary.timeframe} • {summary.reportCount} reports analyzed
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-foreground font-bold text-sm">
                            {new Date(summary.generatedAt).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Mini Executive Summary */}
            {miniSummaryContent}

            {/* Content */}
            <div className="p-6 bg-dark-900">
                {/* Header matching Quick Digest style */}
                <div className="bg-industrial-gradient px-6 py-4 rounded-lg mb-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-white text-2xl font-bold">Executive Summary</h2>
                        <div className="text-right font-bold">
                            <p className="text-white text-sm">
                                Last {summary.timeframe} • {summary.reportCount} reports analyzed
                            </p>
                            <p className="text-white text-sm">
                                {new Date(summary.generatedAt).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
                {mainSummaryContent}
            </div>
        </div>
    );
}

export default React.memo(ExecutiveSummary); 