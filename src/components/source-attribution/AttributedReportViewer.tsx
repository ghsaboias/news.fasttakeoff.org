'use client';

import { useApi } from '@/lib/hooks';
import { DiscordMessage, ReportSourceAttribution } from '@/lib/types/core';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { InteractiveReportBody } from './InteractiveReportBody';

interface AttributedReportViewerProps {
    reportId: string;
    reportBody: string;
    sourceMessages: DiscordMessage[];
    channelId: string;
    className?: string;
    showAttributions?: boolean;
}

const fetchAttributions = async (reportId: string, channelId: string): Promise<ReportSourceAttribution> => {
    const response = await fetch(`/api/source-attribution?reportId=${encodeURIComponent(reportId)}&channelId=${encodeURIComponent(channelId)}`, {
        cache: 'no-cache',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            throw new Error('Report not found');
        }
        throw new Error(`Failed to fetch attributions: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.attributions && Array.isArray(data.attributions)) {
        return data;
    }

    // Some reports might not have attributions yet - this is normal
    return { reportId, attributions: [], generatedAt: new Date().toISOString(), version: '1.0' };
};

export function AttributedReportViewer({
    reportId,
    reportBody,
    sourceMessages,
    channelId,
    className = '',
    showAttributions = true
}: AttributedReportViewerProps) {
    // Memoize the fetcher function
    const memoizedFetcher = useCallback(
        () => fetchAttributions(reportId, channelId),
        [reportId, channelId]
    );

    const { data: attributions, loading: isLoading, error, request: requestAttributions } = useApi<ReportSourceAttribution>(
        memoizedFetcher,
        { manual: true }
    );

    // Fetch attributions when needed
    useEffect(() => {
        if (showAttributions && reportId && channelId) {
            requestAttributions();
        }
    }, [reportId, channelId, showAttributions, requestAttributions]);

    // If attributions are not needed, just render the interactive body without them
    if (!showAttributions) {
        return (
            <div className={className}>
                <InteractiveReportBody
                    reportBody={reportBody}
                    sourceMessages={sourceMessages}
                    showAttributions={false}
                />
            </div>
        );
    }

    // Get unique source messages that are actually used in attributions
    const usedSourceMessages = attributions?.attributions
        ? sourceMessages.filter(msg =>
            attributions.attributions!.some(attr => attr.sourceMessageId === msg.id)
        )
        : [];

    return (
        <div className={className}>
            {/* Interactive Report Body */}
            <InteractiveReportBody
                reportBody={reportBody}
                attributions={attributions || undefined}
                sourceMessages={sourceMessages}
                showAttributions={showAttributions}
            />

            {/* Loading State */}
            {isLoading && (
                <div className="mt-4 flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading source attributions...</span>
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="text-yellow-800 font-medium">Source Attribution Unavailable</div>
                    <div className="text-yellow-700 text-sm mt-1">
                        {error.message}
                    </div>
                </div>
            )}

            {/* Attribution Stats or Empty State */}
            {!isLoading && attributions && attributions.attributions && (
                attributions.attributions.length > 0 ? (
                    <div className="mt-4 text-xs text-gray-500">
                        Generated {attributions.attributions.length} source attribution(s) •
                        Average confidence: {Math.round(
                            attributions.attributions.reduce((sum, attr) => sum + attr.confidence, 0) /
                            attributions.attributions.length * 100
                        )}% •
                        Coverage: {usedSourceMessages?.length}/{sourceMessages?.length} sources
                    </div>
                ) : (
                    <div className="mt-4 text-xs text-gray-500 italic">
                        No source attributions available for this report yet. They may still be generating in the background.
                    </div>
                )
            )}
        </div>
    );
}
