'use client';

import { DiscordMessage, ReportSourceAttribution } from '@/lib/types/core';
import React from 'react';
import { SourceTooltip } from './SourceTooltip';

interface InteractiveReportBodyProps {
    reportBody: string;
    attributions?: ReportSourceAttribution;
    sourceMessages: DiscordMessage[];
    className?: string;
    showAttributions?: boolean;
}

export function InteractiveReportBody({
    reportBody,
    attributions,
    sourceMessages,
    className = '',
    showAttributions = true
}: InteractiveReportBodyProps) {

    // Color palette for different source messages
    const getColorForMessage = (messageId: string, confidence: number): string => {
        const messageIndex = sourceMessages.findIndex(msg => msg.id === messageId);
        const baseOpacity = Math.max(0.15, confidence * 0.4);

        const colors = [
            `rgba(59, 130, 246, ${baseOpacity})`,   // blue
            `rgba(34, 197, 94, ${baseOpacity})`,    // green
            `rgba(249, 115, 22, ${baseOpacity})`,   // orange
            `rgba(147, 51, 234, ${baseOpacity})`,   // purple
            `rgba(236, 72, 153, ${baseOpacity})`,   // pink
            `rgba(14, 165, 233, ${baseOpacity})`,   // sky
            `rgba(168, 85, 247, ${baseOpacity})`,   // violet
            `rgba(239, 68, 68, ${baseOpacity})`,    // red
            `rgba(16, 185, 129, ${baseOpacity})`,   // emerald
            `rgba(245, 158, 11, ${baseOpacity})`,   // amber
        ];

        return colors[messageIndex % colors.length] || `rgba(107, 114, 128, ${baseOpacity})`;
    };

    // Process a single paragraph with attributions
    const processParagraph = (paragraph: string, paragraphStartIndex: number) => {
        if (!showAttributions || !attributions?.attributions?.length) {
            return paragraph;
        }

        const paragraphEndIndex = paragraphStartIndex + paragraph?.length;

        // Find attributions that overlap with this paragraph
        const relevantAttributions = attributions?.attributions?.filter(attr =>
            attr.startIndex < paragraphEndIndex && attr.endIndex > paragraphStartIndex
        ).sort((a, b) => a.startIndex - b.startIndex);

        if (relevantAttributions?.length === 0) {
            return paragraph;
        }

        const elements: React.ReactNode[] = [];
        let currentIndex = paragraphStartIndex;

        relevantAttributions.forEach((attribution, index) => {
            const attrStart = Math.max(attribution.startIndex, paragraphStartIndex);
            const attrEnd = Math.min(attribution.endIndex, paragraphEndIndex);

            // Add text before this attribution
            if (currentIndex < attrStart) {
                const beforeText = reportBody.slice(currentIndex, attrStart);
                elements.push(beforeText);
            }

            // Add the attributed text wrapped in tooltip
            const attributedText = reportBody.slice(attrStart, attrEnd);
            const backgroundColor = getColorForMessage(attribution.sourceMessageId, attribution.confidence);

            elements.push(
                <SourceTooltip
                    key={`attr-${attribution.id}-${index}`}
                    attribution={attribution}
                    sourceMessages={sourceMessages}
                >
                    <span
                        className="cursor-pointer transition-all duration-200 hover:shadow-sm rounded-sm px-0.5"
                        style={{
                            backgroundColor,
                            borderBottom: `2px solid ${backgroundColor.replace(/rgba\((.*?),\s*[\d.]+\)/, 'rgba($1, 0.8)')}`
                        }}
                    >
                        {attributedText}
                    </span>
                </SourceTooltip>
            );

            currentIndex = attrEnd;
        });

        // Add any remaining text after the last attribution
        if (currentIndex < paragraphEndIndex) {
            const remainingText = reportBody.slice(currentIndex, paragraphEndIndex);
            elements.push(remainingText);
        }

        return elements;
    };

    // Create paragraphs with attributions
    const createInteractiveParagraphs = () => {
        const paragraphs = reportBody.split('\n\n').filter(Boolean);
        let textIndex = 0;

        return paragraphs.map((paragraph, paragraphIndex) => {
            const paragraphStartIndex = textIndex;
            const processedContent = processParagraph(paragraph, paragraphStartIndex);

            // Update text index for next paragraph (add 2 for \n\n)
            textIndex = paragraphStartIndex + paragraph?.length + 2;

            return (
                <p key={paragraphIndex} className="text-justify mb-4 last:mb-0">
                    {processedContent}
                </p>
            );
        });
    };

    return (
        <div className={`relative ${className}`}>
            <div className="text-md leading-relaxed">
                {createInteractiveParagraphs()}
            </div>
        </div>
    );
}
