'use client';

import { useExecutiveSummary } from '@/lib/hooks/useExecutiveSummary';
import ReactMarkdown from 'react-markdown';

interface ExecutiveSummaryProps {
    className?: string;
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

export default function ExecutiveSummary({ className = '' }: ExecutiveSummaryProps) {
    const { summary, loading, error, refetch } = useExecutiveSummary();

    if (loading) {
        return (
            <div className={`bg-white shadow-md p-6 ${className}`}>
                <div className="animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-4/6 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-3/6"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`bg-white shadow-md p-6 ${className}`}>
                <div className="text-center">
                    <div className="text-gray-500 mb-4">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Summary Available</h3>
                    <p className="text-gray-500 mb-4">{error.message}</p>
                    <button
                        onClick={() => refetch()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
        <div className={`shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)] ${className}`}>
            {/* Header */}
            <div className="bg-primary px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-background text-sm">
                            Last {summary.timeframe} • {summary.reportCount} reports analyzed
                        </p>
                    </div>
                    <h2 className="text-background text-2xl font-bold">Quick Digest</h2>
                    <div className="text-right">
                        <p className="text-background text-sm">
                            {new Date(summary.generatedAt).toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* Mini Executive Summary */}
            {summary.miniSummary && (() => {
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
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex flex-col gap-6">
                            {rows.map((row, rowIdx) => (
                                <div
                                    key={rowIdx}
                                    className={`flex flex-row flex-wrap gap-2 justify-center`}
                                >
                                    {row.sections.map((section, colIdx) => (
                                        <div
                                            key={colIdx}
                                            className={`flex-1 min-w-[260px] max-w-md bg-white rounded shadow-sm p-4 m-2`}
                                        >
                                            <ReactMarkdown
                                                components={{
                                                    h2: ({ children }) => <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">{children}</h2>,
                                                    ul: ({ children }) => <ul className="list-disc space-y-1 mb-4 ml-4">{children}</ul>,
                                                    li: ({ children }) => <li className="mb-1 text-md">{children}</li>,
                                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                    p: ({ children }) => <p className="mb-4">{children}</p>,
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
            })()}

            {/* Content */}
            <div className="p-6">
                {/* Main heading as page title */}
                <h1 className="text-3xl font-bold text-gray-900 text-center mb-4">Executive Summary</h1>
                {(() => {
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
                                            className={`flex-1 min-w-[260px] max-w-md bg-gray-100 rounded shadow-sm p-4`}
                                        >
                                            <ReactMarkdown
                                                components={{
                                                    h2: ({ children }) => <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">{children}</h2>,
                                                    ul: ({ children }) => <ul className="list-disc mb-4 ml-4">{children}</ul>,
                                                    li: ({ children }) => <li className="my-4">{children}</li>,
                                                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                                                    p: ({ children }) => <p className="mb-4">{children}</p>,
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
                })()}
            </div>
        </div>
    );
} 