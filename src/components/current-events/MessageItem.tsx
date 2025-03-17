"use client";

import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { DiscordMessage } from "@/lib/types/core";
import Image from "next/image";
import MediaPreview from "./MediaPreview";

function formatDate(timestamp: string) {
    return new Date(timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

interface MessageItemProps {
    message: DiscordMessage;
    index: number;
}

export default function MessageItem({ message, index }: MessageItemProps) {
    return (
        <AccordionItem
            value={`message-${index}`}
            className="border-b border-border/40 last:border-0"
        >
            <AccordionTrigger className="text-sm">
                {message.embeds?.[0]?.title || message.embeds?.[0]?.description?.slice(0, 100) || message.content || 'No content'}...
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg">
                    {/* Metadata Section */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            {message.author && (
                                <div className="flex items-center gap-2">
                                    {message.author.avatar && (
                                        <Image
                                            src={`https://cdn.discordapp.com/avatars/${message.author.id}/${message.author.avatar}.png`}
                                            alt={message.author.username}
                                            className="w-5 h-5 rounded-full"
                                        />
                                    )}
                                    <span>{message.author.global_name || message.author.username}</span>
                                </div>
                            )}
                        </div>
                        <time dateTime={message.timestamp}>
                            {formatDate(message.timestamp)}
                        </time>
                    </div>

                    <Separator />

                    {/* Content Section */}
                    {message.content && (
                        <div>
                            <h4 className="font-semibold text-sm">Source:</h4>
                            <a
                                href={message.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-500 hover:underline break-all"
                            >
                                {message.content}
                            </a>
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
                            {embed.fields?.length && embed.fields.length > 0 && (
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
                    {message.attachments?.length && message.attachments.length > 0 && (
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
                    )}

                    {/* Referenced Message Section */}
                    {message.referenced_message && (
                        <>
                            <Separator />
                            <div className="mt-2">
                                <h4 className="font-semibold text-sm">Replying to:</h4>
                                <div className="ml-4 mt-1 p-2 bg-secondary/30 rounded border-l-2 border-primary/50">
                                    <div className="flex items-center gap-2 mb-1">
                                        {message.referenced_message.author?.avatar && (
                                            <Image
                                                src={`https://cdn.discordapp.com/avatars/${message.referenced_message.author.id}/${message.referenced_message.author.avatar}.png`}
                                                alt={message.referenced_message.author.username}
                                                className="w-4 h-4 rounded-full"
                                            />
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                            {message.referenced_message.author?.global_name || message.referenced_message.author?.username}
                                        </span>
                                    </div>
                                    <p className="text-sm">{message.referenced_message.content}</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
} 