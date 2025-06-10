"use client";

import MediaPreview from "@/components/current-events/MediaPreview";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { DiscordMessage } from "@/lib/types/core";
import Image from "next/image";

interface MessageItemProps {
    message: DiscordMessage;
    index: number;
    noAccordion?: boolean;
}

export default function MessageItemTimeline({ message, index, noAccordion = false }: MessageItemProps) {
    const MessageContent = () => (
        <div className="space-y-4 bg-secondary-light rounded-lg">
            {/* Content Section */}
            {message.content && (
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                    <div className="w-full">
                        <h4 className="font-semibold text-sm">Source:</h4>
                        <a
                            href={message.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline break-words inline-block max-w-full"
                        >
                            {message.content}
                        </a>
                    </div>
                    <time dateTime={message.timestamp} className="text-sm text-muted-foreground whitespace-nowrap">
                        <LocalDateTimeFull
                            dateString={message.timestamp}
                            options={{
                                dateStyle: 'medium',
                                timeStyle: 'short'
                            }}
                        />
                    </time>
                </div>
            )}

            {/* Embeds Section */}
            {message.embeds?.map((embed, embedIndex) => (
                <div key={embedIndex} className="space-y-2">
                    {embed.title && (
                        <div>
                            <h4 className="font-semibold text-sm">Title:</h4>
                            <p className="text-sm">{embed.title}</p>
                        </div>
                    )}
                    {embed.description && (
                        <div>
                            <h4 className="font-semibold text-sm">Description:</h4>
                            <p className="text-sm">{embed.description}</p>
                        </div>
                    )}
                    {embed.fields && embed.fields.length > 0 && (
                        <div className="space-y-2">
                            {/* Only show Additional Information header if we have non-redundant fields */}
                            {embed.fields.some(field =>
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
                                        <p className="text-sm break-words">{field.value}</p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {embed.author && (
                        <div className="flex items-center gap-2 mt-2">
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
                            <span className="text-sm text-muted-foreground">
                                {embed.author.name}
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {/* Media Section */}
            {message.attachments?.length && message.attachments.length > 0 ? (
                <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Media:</h4>
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