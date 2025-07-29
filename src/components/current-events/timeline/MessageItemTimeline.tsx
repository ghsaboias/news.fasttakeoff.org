"use client";

import TweetEmbed from "@/components/current-events/DynamicTweetEmbed";
import MediaPreview from "@/components/current-events/MediaPreview";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { DiscordMessage } from "@/lib/types/core";
import Image from "next/image";
import React from "react";

interface MessageItemProps {
    message: DiscordMessage;
    index: number;
    noAccordion?: boolean;
    channelId?: string;
}

// Regex to match URLs (http or https)
const urlRegex = /(https?:\/\/[^\s]+)/g;

/**
 * Splits the given text into parts and wraps any URL part in an <a> tag.
 */
function renderWithLinks(text: string) {
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
        if (urlRegex.test(part)) {
            return (
                <a
                    key={index}
                    href={part}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline break-words"
                >
                    {part}
                </a>
            );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
    });
}

export default function MessageItemTimeline({ message, index, noAccordion = false, channelId }: MessageItemProps) {
    const MessageContent = () => (
        <div className="bg-secondary-light rounded-lg">
            {/* Content Section */}
            <time dateTime={message.timestamp} className="text-sm text-foreground">
                <LocalDateTimeFull
                    dateString={message.timestamp}
                    options={{
                        dateStyle: 'medium',
                        timeStyle: 'short'
                    }}
                />
            </time>
            {message.content && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full">
                        <a
                            href={message.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline break-words inline-block max-w-full"
                        >
                            {message.content}
                        </a>
                    </div>
                </div>
            )}

            {/* Tweet Embeds Section */}
            {message.content && (
                <TweetEmbed
                    content={message.content}
                    channelId={channelId}
                    className="mt-4"
                />
            )}

            {/* Embeds Section */}
            {message.embeds?.map((embed, embedIndex) => (
                <div key={embedIndex} className="py-2 flex flex-col gap-2">
                    {embed.title && (
                        <div>
                            <p className="text-sm break-words">{renderWithLinks(embed.title)}</p>
                        </div>
                    )}
                    {embed.description && (
                        <div>
                            <p className="text-sm break-words">{renderWithLinks(embed.description)}</p>
                        </div>
                    )}
                    {embed.fields && embed.fields.length > 1 && (
                        <div className="space-y-2">
                            {/* Only show Additional Information header if we have non-redundant fields */}
                            {embed.fields?.some(field =>
                                field.value !== message.content &&
                                !field.value.includes(message.content || '') &&
                                field.value !== embed.description
                            ) && (
                                    <h4 className="font-semibold text-sm">Additional Information:</h4>
                                )}
                            {embed.fields.map((field, fieldIndex) => {
                                // Skip fields that are just repeating the source URL or description
                                if (
                                    field.value === message.content ||
                                    field.value.includes(message.content || '') ||
                                    field.value === embed.description
                                ) {
                                    return null;
                                }
                                return (
                                    <div key={fieldIndex} className="ml-2 mt-3">
                                        <p className="text-sm font-medium">{field.name}:</p>
                                        <p className="text-sm break-words">{renderWithLinks(field.value)}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {embed.author && (
                        <div className="flex items-center gap-2">
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
                            <span className="text-sm">
                                {embed.author.name}
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {/* Media Section */}
            {message.attachments?.length && message.attachments.length > 0 ? (
                <div>
                    <div className="grid grid-cols-2 gap-4">
                        {message.attachments.map((attachment) => {
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
                            return null;
                        })}
                    </div>
                </div>
            ) : (
                <></>
            )}
        </div>
    );

    if (noAccordion) {
        return <MessageContent />;
    }

    return (
        <AccordionItem
            value={`message-${index}`}
            className="border-b border-border last:border-0"
        >
            <AccordionTrigger className="text-sm">
                {message.embeds?.[0]?.title || message.embeds?.[0]?.description?.slice(0, 100) || message.content || 'No content'}...
            </AccordionTrigger>
            <AccordionContent>
                <MessageContent />
            </AccordionContent>
        </AccordionItem>
    );
} 