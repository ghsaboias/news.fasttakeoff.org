"use client";

import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { TIME } from "@/lib/config";
import { DiscordMessage } from "@/lib/types/core";
import { detectTelegramUrls } from "@/lib/utils";
import { detectTweetUrls } from "@/lib/utils/twitter-utils";
import Image from "next/image";
import Link from "next/link";
import React, { useMemo, useState, useCallback } from "react";
import TweetEmbed from "./DynamicTweetEmbed";
import MediaPreview from "./MediaPreview";
import TelegramEmbed from "./TelegramEmbed";
import TranslationBadge from "./TranslationBadge";

interface MessageItemProps {
    message: DiscordMessage;
    noAccordion?: boolean;
    channelId?: string;
}

function MessageItem({ message, noAccordion = false, channelId }: MessageItemProps) {
    // State to track if tweet embed failed
    const [tweetEmbedFailed, setTweetEmbedFailed] = useState(false);

    // Memoize expensive URL detection and embed processing
    const {
        isTwitterPost,
        isTelegramPost,
        hasEmbeddableContent,
        isOlderThan24Hours,
        twitterEmbed,
        translationEmbed,
        translationFooter
    } = useMemo(() => {
        const isTwitterPost = message.content ? detectTweetUrls(message.content).length > 0 : false;
        const isTelegramPost = message.content ? detectTelegramUrls(message.content).length > 0 : false;
        const hasEmbeddableContent = isTwitterPost || isTelegramPost;

        // Check if message is older than 24 hours
        const messageDate = new Date(message.timestamp);
        const now = new Date();
        const isOlderThan24Hours = (now.getTime() - messageDate.getTime()) > TIME.DAY_MS;

        // Find Twitter-related embed data for fallback
        const twitterEmbed = message.embeds?.find(embed =>
            embed.url && (embed.url.includes('twitter.com') || embed.url.includes('x.com'))
        );

        // Find translation info from any embed (for Twitter posts)
        const translationEmbed = message.embeds?.find(embed =>
            embed.footer?.text && embed.footer?.text.includes('Translated from: ')
        );
        const translationFooter = translationEmbed?.footer?.text;

        return {
            isTwitterPost,
            isTelegramPost,
            hasEmbeddableContent,
            isOlderThan24Hours,
            twitterEmbed,
            translationEmbed,
            translationFooter
        };
    }, [message.content, message.timestamp, message.embeds]);

    // Memoize callback for embed failure
    const handleTweetEmbedFail = useCallback(() => {
        setTweetEmbedFailed(true);
    }, []);

    // Show Discord message fallback for Twitter posts when embed fails
    const showDiscordFallback = isTwitterPost && tweetEmbedFailed;

    const MessageContent = () => (
        <div className={`py-6 border-b border-soft-border-foreground ${showDiscordFallback ? 'px-6' : ''}`}>
            {/* Content Section - Show for non-embeddable content OR when Twitter embed fails */}
            {(showDiscordFallback) && <div className="flex flex-col pb-2">
                {/* Show fallback message for deleted tweets */}
                <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-black">
                        ⚠️ This post is no longer available (possibly deleted). Showing original content captured by Discord:
                    </p>
                </div>
            </div>}

            {/* Show Discord embed data as fallback for deleted tweets */}
            {showDiscordFallback && twitterEmbed && (
                <div className="mt-4 p-4 border border-gray-200 rounded-lg">
                    {/* Translation Badge - show if content is translated */}
                    {translationFooter && (
                        <div className="mb-3">
                            <TranslationBadge
                                footerText={translationFooter}
                            />
                        </div>
                    )}

                    {/* Author info */}
                    {twitterEmbed.author && (
                        <div className="flex items-center gap-2 mb-3">
                            {twitterEmbed.author.icon_url && (
                                <Image
                                    src={twitterEmbed.author.icon_url}
                                    alt={twitterEmbed.author.name || "Author"}
                                    className="w-6 h-6 rounded-full"
                                    width={24}
                                    height={24}
                                    unoptimized
                                />
                            )}
                            <span className="font-medium text-sm">
                                @{twitterEmbed.author.name}
                            </span>
                        </div>
                    )}

                    {/* Tweet content */}
                    {twitterEmbed.description && (
                        <div className="mb-3">
                            <p className="text-sm whitespace-pre-wrap">{twitterEmbed.description}</p>
                        </div>
                    )}

                    {/* Tweet timestamp */}
                    {twitterEmbed.timestamp && (
                        <div className="text-xs">
                            <LocalDateTimeFull
                                dateString={twitterEmbed.timestamp}
                                options={{
                                    dateStyle: 'medium',
                                    timeStyle: 'short'
                                }}
                            />
                        </div>
                    )}

                    {/* Footer info - but skip translation info since we show it as badge */}
                    {twitterEmbed.footer && !twitterEmbed.footer.text.includes("FaytuksBot") && !twitterEmbed.footer.text.includes("Translated from:") && (
                        <div className="mt-2 text-xs">
                            {twitterEmbed.footer.text}
                        </div>
                    )}
                </div>
            )}

            {/* Tweet Embeds Section - Only show if not failed */}
            {message.content && isTwitterPost && !tweetEmbedFailed && (
                <TweetEmbed
                    content={message.content}
                    channelId={channelId}
                    onEmbedFail={handleTweetEmbedFail}
                />
            )}

            {/* Translation Badge for Twitter posts - show below tweet embed */}
            {isTwitterPost && !tweetEmbedFailed && translationEmbed && (
                <div className="mt-2">
                    <div className="border border-soft-border-foreground p-4 rounded-lg">
                        {/* Translation Badge */}
                        <div className="mb-3">
                            <TranslationBadge
                                footerText={translationFooter}
                            />
                        </div>

                        {/* Translated Content */}
                        {translationEmbed.description && (
                            <div className="mb-3">
                                <p className="text-sm leading-relaxed break-words">
                                    {translationEmbed.description}
                                </p>
                            </div>
                        )}

                        {/* Additional Fields if present */}
                        {translationEmbed.fields?.length && translationEmbed.fields.length > 0 && (
                            <div className="space-y-2">
                                {translationEmbed.fields.map((field, fieldIndex) => {
                                    // Skip source field as it's redundant
                                    if (field.name.includes('Source')) return null;

                                    return (
                                        <div key={fieldIndex} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                                            <p className="text-md">
                                                {field.name}:
                                            </p>
                                            <p className="text-sm">
                                                {field.value.replace(/Translated from: \w+/, '')}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Telegram Embeds Section */}
            {message.content && isTelegramPost && (
                <TelegramEmbed
                    content={message.content}
                />
            )}

            {/* Regular Discord embeds - Show for non-Twitter/Telegram posts OR when Twitter embed fails OR when Twitter has translation info */}
            {(!hasEmbeddableContent || showDiscordFallback) && message.embeds?.length && message.embeds.length > 0 && (
                <div className="flex flex-col gap-4 mt-4 px-4">
                    {/* Embeds Section */}
                    {message.embeds?.map((embed, embedIndex) => {
                        // Skip Twitter embeds if we're showing them as fallback (but not when showing translation info)
                        if (showDiscordFallback && embed.url && (embed.url.includes('twitter.com') || embed.url.includes('x.com'))) {
                            return null;
                        }

                        return (
                            <Link key={embedIndex} href={embed.url || ''} target="_blank" rel="noopener noreferrer" className="border border-soft-border-foreground rounded-lg p-4">
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
                                {/* Embed Title */}
                                {embed.title && (
                                    <div className="mb-3">
                                        {embed.url ? (
                                            <h3
                                                className="text-base font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {embed.title}
                                            </h3>
                                        ) : (
                                            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                                                {embed.title}
                                            </h3>
                                        )}
                                    </div>
                                )}

                                {/* Embed Thumbnail - Only show if message is less than 24 hours old */}
                                {embed.thumbnail?.url && (
                                    <div className="mb-3">
                                        <Image
                                            src={embed.thumbnail.proxy_url || embed.thumbnail.url}
                                            alt={embed.title || "Article image"}
                                            width={embed.thumbnail.width || 400}
                                            height={embed.thumbnail.height || 200}
                                            className="rounded-lg w-full h-auto max-w-md object-cover"
                                            unoptimized
                                        />
                                    </div>
                                )}

                                {/* Translation Badge - show if content is translated */}
                                {embed.footer?.text && embed.footer?.text.includes('Translated from: ') && (
                                    <div className="mb-3">
                                        <TranslationBadge
                                            footerText={embed.footer?.text}
                                        />
                                    </div>
                                )}

                                {/* Embed Description */}
                                {embed.description && (
                                    <div className="mb-3">
                                        <p className="text-sm leading-relaxed break-words">
                                            {embed.description}
                                        </p>
                                    </div>
                                )}

                                {/* Embed Author */}
                                {embed.author && (
                                    <div className="flex items-center gap-2 mb-3">
                                        {embed.author.icon_url && (
                                            <Image
                                                src={embed.author.icon_url}
                                                alt={embed.author.name || "Author"}
                                                className="w-5 h-5 rounded-full"
                                                width={20}
                                                height={20}
                                                unoptimized
                                            />
                                        )}
                                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                            {embed.author.name}
                                        </span>
                                    </div>
                                )}

                                {/* Embed Fields */}
                                {embed.fields?.length && embed.fields.length > 0 && embed.fields.every(field => !field.value.toLowerCase().includes(message.content?.toLowerCase() || '')) && (
                                    <div className="space-y-2">
                                        {embed.fields.map((field, fieldIndex) => {
                                            if (field.name.includes('Source')) return null;

                                            return (
                                                <div key={fieldIndex} className="border-l-2 border-gray-300 dark:border-gray-600 pl-3">
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                        {field.name}:
                                                    </p>
                                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                                        {field.value.replace(/Translated from: \w+/, '')}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Embed URL (if different from title link) */}
                                {embed.url && !embed.title && (
                                    <div className="mt-2">
                                        <span className="text-sm text-blue-600 dark:text-blue-400 break-all">
                                            {embed.url}
                                        </span>
                                    </div>
                                )}
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* Media Section - Hide if this is a Twitter/Telegram post (embeds will handle the media) UNLESS Twitter embed failed */}
            {(!hasEmbeddableContent || showDiscordFallback) && message.attachments?.length && message.attachments.length > 0 && !isOlderThan24Hours ? (
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

export default React.memo(MessageItem); 