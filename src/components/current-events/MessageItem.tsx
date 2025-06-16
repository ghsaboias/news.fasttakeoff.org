"use client";

import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { DiscordMessage } from "@/lib/types/core";
import Image from "next/image";
import Link from "next/link";
import MediaPreview from "./MediaPreview";

interface MessageItemProps {
    message: DiscordMessage;
    index: number;
    noAccordion?: boolean;
}

export default function MessageItem({ message, index, noAccordion = false }: MessageItemProps) {
    const MessageContent = () => (
        <div className={`px-2 py-6 ${index !== 0 && 'border-t border-soft-border-foreground'}`}>
            {/* Content Section */}
            <div className="flex flex-col pb-2">
                {message.content && (
                    <LocalDateTimeFull
                        dateString={message.timestamp}
                        options={{
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        }}
                        className="text-sm"
                    />
                )}

                <Link
                    href={message.content}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-500 hover:underline break-all"
                >
                    {message.content}
                </Link>
            </div>

            {/* Embeds Section */}
            {message.embeds?.map((embed, embedIndex) => (
                <div key={embedIndex} className="space-y-2">
                    {embed.title && (
                        <div>
                            <p className="text-sm">{embed.title}</p>
                        </div>
                    )}
                    {embed.description && (
                        <p className="text-sm">{embed.description}</p>
                    )}
                    {embed.fields?.length && embed.fields.length > 0 && embed.fields.every(field => !field.value.toLowerCase().includes(message.content?.toLowerCase() || '')) && (
                        <div>
                            <h4 className="font-semibold text-sm">Additional Information:</h4>
                            {embed.fields.map((field, fieldIndex) => (
                                <div key={fieldIndex} className="ml-4 mt-2">
                                    <p className="text-sm font-medium">{field.name}:</p>
                                    <p className="text-sm">{field.value}</p>
                                </div>
                            ))}
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
                            <span className="text-sm text-foreground">
                                {embed.author.name}
                            </span>
                        </div>
                    )}
                </div>
            ))}

            {/* Media Section */}
            {message.attachments?.length && message.attachments.length > 0 ? (
                <div className="space-y-2 mt-2">
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
        <MessageContent />
    );
} 