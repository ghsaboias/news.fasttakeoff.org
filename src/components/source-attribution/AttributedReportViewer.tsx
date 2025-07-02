'use client';

import { DiscordMessage, ReportSourceAttribution } from '@/lib/types/core';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { InteractiveReportBody } from './InteractiveReportBody';

interface AttributedReportViewerProps {
    reportId: string;
    reportBody: string;
    sourceMessages: DiscordMessage[];
    className?: string;
    showAttributions?: boolean;
}

export function AttributedReportViewer({
    reportId,
    reportBody,
    sourceMessages,
    className = '',
    showAttributions = true
}: AttributedReportViewerProps) {
    const [attributions, setAttributions] = useState<ReportSourceAttribution | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAttributions() {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch(`/api/source-attribution?reportId=${encodeURIComponent(reportId)}`);

                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error('Report not found');
                    }
                    throw new Error(`Failed to fetch attributions: ${response.status}`);
                }

                const data = await response.json();
                setAttributions(data);
            } catch (err) {
                console.error('Error fetching source attributions:', err);
                setError(err instanceof Error ? err.message : 'Failed to load source attributions');
            } finally {
                setIsLoading(false);
            }
        }

        // Only fetch attributions when showAttributions is true and we don't have them yet
        if (reportId && showAttributions && !attributions && !isLoading) {
            fetchAttributions();
        }
    }, [reportId, showAttributions, attributions, isLoading]);

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

    if (isLoading) {
        return (
            <div className={`flex items-center justify-center p-8 ${className}`}>
                <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading source attributions...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={className}>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="text-yellow-800 font-medium">Source Attribution Unavailable</div>
                    <div className="text-yellow-700 text-sm mt-1">
                        {error}. Showing plain report text.
                    </div>
                </div>
                <InteractiveReportBody
                    reportBody={reportBody}
                    sourceMessages={sourceMessages}
                    showAttributions={showAttributions}
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

            {/* Attribution Stats */}
            {attributions?.attributions && attributions?.attributions?.length > 0 && (
                <div className="mt-4 text-xs text-gray-500">
                    Generated {attributions?.attributions?.length} source attribution(s) •
                    Average confidence: {Math.round(
                        attributions?.attributions?.reduce((sum, attr) => sum + attr.confidence, 0) /
                        attributions?.attributions?.length * 100
                    )}% •
                    Coverage: {usedSourceMessages?.length}/{sourceMessages?.length} sources
                </div>
            )}
        </div>
    );
}
