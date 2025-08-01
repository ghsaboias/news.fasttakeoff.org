'use client';

import { Popover, PopoverArrow, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LocalDateTimeFull } from '@/components/utils/LocalDateTime';
import { DiscordMessage, SourceAttribution } from '@/lib/types/core';
import { detectTelegramUrls } from '@/lib/utils';
import { detectTweetUrls } from '@/lib/utils/twitter-utils';
import Image from 'next/image';
import Link from 'next/link';
import MediaPreview from '../current-events/MediaPreview';

interface SourceTooltipProps {
    attribution: SourceAttribution;
    sourceMessages: DiscordMessage[];
    children: React.ReactNode;
}

// Helper function to parse text and render URLs as clickable links
function parseTextWithLinks(text: string): (string | React.ReactElement)[] {
    const elements: (string | React.ReactElement)[] = [];
    let currentIndex = 0;
    let keyCounter = 0;

    // Combined regex to match either markdown links or plain URLs
    const combinedRegex = /(\[([^\]]+)\]\((https?:\/\/[^)]+)\))|(https?:\/\/[^\s]+)/g;

    let match;
    while ((match = combinedRegex.exec(text)) !== null) {
        const [fullMatch, markdownFull, markdownText, markdownUrl, plainUrl] = match;

        // Add text before the match
        if (match.index > currentIndex) {
            elements.push(text.slice(currentIndex, match.index));
        }

        if (markdownFull) {
            // It's a markdown link [text](url)
            elements.push(
                <Link
                    key={`link-${keyCounter++}`}
                    href={markdownUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:underline"
                >
                    {markdownText}
                </Link>
            );
        } else if (plainUrl) {
            // It's a plain URL
            elements.push(
                <Link
                    key={`link-${keyCounter++}`}
                    href={plainUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-300 hover:underline"
                >
                    {plainUrl}
                </Link>
            );
        }

        currentIndex = match.index + fullMatch.length;
    }

    // Add any remaining text
    if (currentIndex < text.length) {
        elements.push(text.slice(currentIndex));
    }

    return elements;
}

function TooltipContentBody({ attribution, sourceMessages }: { attribution: SourceAttribution; sourceMessages: DiscordMessage[] }) {
    // Get the source message for this attribution
    const sourceMessage = sourceMessages.find(msg => msg.id === attribution.sourceMessageId);

    const getConfidenceColor = (confidence: number) => {
        if (confidence >= 0.8) return 'text-green-600';
        if (confidence >= 0.6) return 'text-yellow-600';
        return 'text-red-600';
    };

    if (!sourceMessage) {
        return (
            <div className="text-xs text-red-500">
                Source message not found (ID: {attribution.sourceMessageId})
            </div>
        );
    }

    const isTwitterPost = sourceMessage.content ? detectTweetUrls(sourceMessage.content).length > 0 : false;
    const isTelegramPost = sourceMessage.content ? detectTelegramUrls(sourceMessage.content).length > 0 : false;

    return (
        <div className="w-full max-w-xs sm:max-w-lg max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-3 gap-1 sm:gap-0">
                <div className="text-sm font-semibold text-white">
                    Source Message
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3">
                    <div className={`text-xs sm:text-sm font-medium ${getConfidenceColor(attribution.confidence)}`}>
                        {Math.round(attribution.confidence * 100)}% confident
                    </div>
                    <div className="text-xs text-muted-foreground">
                        <LocalDateTimeFull
                            dateString={sourceMessage.timestamp}
                            options={{
                                dateStyle: 'short',
                                timeStyle: 'short'
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Selected Text */}
            <div className="mb-3 p-2 bg-accent/10 rounded border border-accent/20">
                <div className="text-xs text-muted-foreground mb-1">Selected Text:</div>
                <p className="text-sm font-medium text-popover-foreground break-words">&ldquo;{attribution.text}&rdquo;</p>
            </div>

            {/* Message Details */}
            <div className="space-y-3">
                {/* Message Content */}
                {sourceMessage.content && !sourceMessage.content.includes('https') && (
                    <div className="p-2 bg-muted/30 rounded border border-muted/50">
                        <div className="text-xs text-muted-foreground mb-1">Content:</div>
                        <div className="text-sm text-popover-foreground break-words break-all">
                            {isTwitterPost || isTelegramPost ? (
                                <Link
                                    href={sourceMessage.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accent hover:underline"
                                >
                                    {sourceMessage.content}
                                </Link>
                            ) : (
                                sourceMessage.content
                            )}
                        </div>
                    </div>
                )}

                {/* Embeds */}
                {sourceMessage.embeds && sourceMessage.embeds.length > 0 && (
                    <div className="space-y-2">
                        {sourceMessage.embeds.slice(0, 2).map((embed, embedIndex) => (
                            <div key={embedIndex} className="p-2 bg-muted/30 rounded border border-muted/50 text-xs">
                                {/* Embed Author */}
                                {embed.author && (
                                    <div className="flex items-center gap-2 mb-2">
                                        {embed.author.icon_url && (
                                            <Image
                                                src={embed.author.icon_url}
                                                alt={embed.author.name || "Author"}
                                                className="w-4 h-4 rounded-full"
                                                width={16}
                                                height={16}
                                                unoptimized
                                            />
                                        )}
                                        <div className="flex-1">
                                            <span className="font-medium text-popover-foreground">
                                                {embed.author.name}
                                            </span>
                                            {embed.timestamp && (
                                                <div className="text-xs text-muted-foreground">
                                                    <LocalDateTimeFull
                                                        dateString={embed.timestamp}
                                                        options={{
                                                            dateStyle: 'short',
                                                            timeStyle: 'short'
                                                        }}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Embed Title */}
                                {embed.title && (
                                    <div className="mb-2">
                                        {embed.url ? (
                                            <Link
                                                href={embed.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-medium text-accent hover:underline line-clamp-2"
                                            >
                                                {embed.title}
                                            </Link>
                                        ) : (
                                            <div className="font-medium text-popover-foreground line-clamp-2">
                                                {embed.title}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Embed Description */}
                                {embed.description && (
                                    <div className="mb-2">
                                        <p className="text-popover-foreground line-clamp-5">
                                            {embed.description}
                                        </p>
                                    </div>
                                )}

                                {/* Embed Thumbnail */}
                                {embed.thumbnail?.url && (
                                    <div className="mb-2">
                                        <MediaPreview
                                            url={embed.thumbnail.proxy_url || embed.thumbnail.url}
                                            type="image"
                                            alt={embed.title || "Embed thumbnail"}
                                        />
                                    </div>
                                )}

                                {/* Embed Fields */}
                                {embed.fields && embed.fields.length > 0 && (
                                    <div className="space-y-1">
                                        {embed.fields.slice(0, 2).map((field, fieldIndex) => (
                                            <div key={fieldIndex} className="border-l-2 border-accent/40 pl-2">
                                                <p className="font-medium text-popover-foreground">
                                                    {field.name}:
                                                </p>
                                                <p className="text-muted-foreground line-clamp-2">
                                                    {parseTextWithLinks(field.value)}
                                                </p>
                                            </div>
                                        ))}
                                        {embed.fields.length > 2 && (
                                            <div className="text-muted-foreground text-center">
                                                + {embed.fields.length - 2} more fields
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Translation info */}
                                {embed.footer?.text && embed.footer.text.includes('Translated from:') && (
                                    <div className="mt-1 text-muted-foreground italic">
                                        {embed.footer.text}
                                    </div>
                                )}
                            </div>
                        ))}
                        {sourceMessage.embeds.length > 2 && (
                            <div className="text-xs text-muted-foreground text-center">
                                + {sourceMessage.embeds.length - 2} more embeds
                            </div>
                        )}
                    </div>
                )}

                {/* Attachments */}
                {sourceMessage.attachments && sourceMessage.attachments.length > 0 && (
                    <div className="space-y-2">
                        <div className="text-xs text-muted-foreground font-medium">
                            Media ({sourceMessage.attachments.length}):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {sourceMessage.attachments.slice(0, 4).map((attachment) => {
                                if (attachment.content_type?.startsWith('image/')) {
                                    return (
                                        <MediaPreview
                                            key={attachment.id}
                                            url={attachment.url}
                                            type="image"
                                            alt={attachment.filename}
                                        />
                                    );
                                } else if (attachment.content_type?.startsWith('video/')) {
                                    return (
                                        <MediaPreview
                                            key={attachment.id}
                                            url={attachment.url}
                                            type="video"
                                            contentType={attachment.content_type}
                                        />
                                    );
                                }
                                return (
                                    <div key={attachment.id} className="bg-muted/30 rounded border border-muted/50 p-2 h-12 flex items-center justify-center">
                                        <span className="text-xs text-muted-foreground">📎 File</span>
                                    </div>
                                );
                            })}
                        </div>
                        {sourceMessage.attachments.length > 4 && (
                            <div className="text-xs text-muted-foreground text-center">
                                + {sourceMessage.attachments.length - 4} more files
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export function SourceTooltip({ attribution, sourceMessages, children }: SourceTooltipProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                {children}
            </PopoverTrigger>
            <PopoverContent
                side="top"
                className="bg-popover border-border text-popover-foreground p-3 sm:p-4 w-screen max-w-xs sm:max-w-lg sm:w-auto mx-2 sm:mx-0"
                sideOffset={8}
            >
                <PopoverArrow className="fill-popover" />
                <TooltipContentBody attribution={attribution} sourceMessages={sourceMessages} />
            </PopoverContent>
        </Popover>
    );
}
