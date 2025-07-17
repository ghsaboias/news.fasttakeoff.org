'use client';

import { useExecutiveSummary } from '@/lib/hooks/useExecutiveSummary';
import ReactMarkdown from 'react-markdown';

interface ExecutiveSummaryProps {
    className?: string;
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
                    <div className="text-right">
                        <p className="text-background text-xs">
                            {new Date(summary.generatedAt).toLocaleString()}
                        </p>
                        <button
                            onClick={() => refetch()}
                            className="mt-1 text-blue-200 hover:text-white text-xs underline hidden"
                        >
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="p-6">
                <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                        components={{
                            h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-4 text-center">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-900 mt-4 mb-2">{children}</h3>,
                            p: ({ children }) => <p className="mb-4">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc space-y-1 mb-4 ml-4">{children}</ul>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                        }}
                    >
                        {summary.summary}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
    );
} 