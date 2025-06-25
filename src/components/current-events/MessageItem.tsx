"use client";

import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { DiscordMessage } from "@/lib/types/core";
import { detectTelegramUrls } from "@/lib/utils";
import { detectTweetUrls } from "@/lib/utils/twitter-utils";
import Link from "next/link";
import MediaPreview from "./MediaPreview";
import TelegramEmbed from "./TelegramEmbed";
import TranslationBadge from "./TranslationBadge";
import TweetEmbed from "./TweetEmbed";

interface MessageItemProps {
    message: DiscordMessage;
    index: number;
    noAccordion?: boolean;
    channelId?: string;
}

export default function MessageItem({ message, index, noAccordion = false, channelId }: MessageItemProps) {
    // Check if this message contains X/Twitter or Telegram URLs
    const isTwitterPost = message.content ? detectTweetUrls(message.content).length > 0 : false;
    const isTelegramPost = message.content ? detectTelegramUrls(message.content).length > 0 : false;
    const hasEmbeddableContent = isTwitterPost || isTelegramPost;

    const MessageContent = () => (
        <div className="px-2 py-6 border-b border-soft-border-foreground">
            {/* Content Section */}
            {!hasEmbeddableContent && <div className="flex flex-col pb-2">
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
            </div>}

            {/* Tweet Embeds Section */}
            {message.content && isTwitterPost && (
                <TweetEmbed
                    content={message.content}
                    channelId={channelId}
                />
            )}

            {/* Telegram Embeds Section */}
            {message.content && isTelegramPost && (
                <TelegramEmbed
                    content={message.content}
                />
            )}

            {message.embeds?.length && message.embeds.length > 0 && <div className="flex flex-col gap-4 mt-4 px-4">
                {/* Embeds Section */}
                {message.embeds?.map((embed, embedIndex) => (
                    <div key={embedIndex} className="space-y-2 flex-col gap-4">
                        {embed.title && (
                            <div className="mb-4">
                                <p className="text-sm">{embed.title}</p>
                            </div>
                        )}
                        {embed.description && embed.footer?.text && (
                            <div className="space-y-2">
                                {/* Translation Badge - show above description if content is translated */}
                                <TranslationBadge
                                    footerText={embed.footer?.text}
                                    className="mb-2"
                                />
                                <p className="text-sm">{embed.description}</p>
                            </div>
                        )}
                        {embed.fields?.length && embed.fields.length > 0 && embed.fields.every(field => !field.value.toLowerCase().includes(message.content?.toLowerCase() || '')) && (
                            <div>
                                {embed.fields.map((field, fieldIndex) => {
                                    if (field.name.includes('Source')) return null;

                                    return (
                                        <div key={fieldIndex} className="ml-4 mt-2">
                                            <p className="text-sm font-medium">{field.name}:</p>
                                            <p className="text-sm">{field.value.replace(/Translated from: \w+/, '')}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            }
            {/* Media Section - Hide if this is a Twitter/Telegram post (embeds will handle the media) */}
            {!hasEmbeddableContent && message.attachments?.length && message.attachments.length > 0 ? (
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