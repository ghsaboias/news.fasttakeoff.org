// src/app/current-events/CurrentEventsClient.tsx
"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Report } from "@/lib/data/discord-reports";
import { DiscordChannel, DiscordMessage } from "@/lib/types/core";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import Image from "next/image";
import { useState } from "react";

function formatDate(timestamp: string) {
    return new Date(timestamp).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
}

export interface Props {
    channels: DiscordChannel[];
}

interface MediaPreviewProps {
    url: string;
    type: 'image' | 'video';
    contentType?: string;
    alt?: string;
}

function MediaPreview({ url, type, contentType, alt }: MediaPreviewProps) {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div className="cursor-pointer w-full aspect-video bg-muted rounded-lg overflow-hidden">
                    {type === 'image' ? (
                        <Image
                            src={url}
                            alt={alt || 'Media content'}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                        />
                    ) : (
                        <video
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                        >
                            <source src={url} type={contentType} />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </DialogTrigger>
            <DialogContent className="max-w-7xl w-full p-0 bg-transparent border-0 [&>button]:hidden" aria-describedby={undefined}>
                <VisuallyHidden>
                    <DialogTitle>{alt || 'Media content'}</DialogTitle>
                </VisuallyHidden>
                <div className="relative w-full h-full flex items-center justify-center">
                    {type === 'image' ? (
                        <Image
                            src={url}
                            alt={alt || 'Media content'}
                            className="max-h-[90vh] max-w-full object-contain rounded-lg"
                        />
                    ) : (
                        <video
                            controls
                            className="max-h-[90vh] max-w-full rounded-lg"
                        >
                            <source src={url} type={contentType} />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function CurrentEventsClient({ channels }: Props) {
    const [channelData, setChannelData] = useState<Map<string, { count: number; messages: DiscordMessage[]; loading: boolean }>>(
        new Map()
    );
    const [channelReports, setChannelReports] = useState<Map<string, { report: Report | null; loading: boolean; error: string | null }>>(
        new Map()
    );

    const fetchMessages = async (channelId: string) => {
        setChannelData(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, { ...newMap.get(channelId) || { count: 0, messages: [] }, loading: true });
            return newMap;
        });

        try {
            const response = await fetch(`/api/channels/${channelId}/messages`);
            if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
            const { count, messages } = await response.json();

            setChannelData(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { count, messages, loading: false });
                return newMap;
            });
        } catch (error) {
            console.error(`[Client] Error fetching messages for channel ${channelId}:`, error);
            setChannelData(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { count: 0, messages: [], loading: false });
                return newMap;
            });
        }
    };

    const generateChannelReport = async (channelId: string) => {
        setChannelReports(prev => {
            const newMap = new Map(prev);
            newMap.set(channelId, { report: null, loading: true, error: null });
            return newMap;
        });

        try {
            console.log(`[Client] Sending POST to /api/reports with channelId: ${channelId}`);
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId, timeframe: '1h' }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Client] Fetch failed with status ${response.status}: ${errorText}`);
                throw new Error(`Failed to generate report: ${response.status} - ${errorText}`);
            }

            const { report } = await response.json();
            console.log('[Client] Report received:', report);

            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, { report, loading: false, error: null });
                return newMap;
            });
        } catch (error) {
            console.error('[Client] Error generating report:', error);
            setChannelReports(prev => {
                const newMap = new Map(prev);
                newMap.set(channelId, {
                    report: null,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to generate report',
                });
                return newMap;
            });
        }
    };

    return (
        <div className="container mx-auto py-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold">Current Events</h1>
                <Badge variant="secondary">
                    Total Channels: {channels.length}
                </Badge>
            </div>
            <div className="grid gap-6">
                {channels.map(channel => (
                    <Card key={channel.id}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>{channel.name}</CardTitle>
                                <div className="flex gap-2">
                                    <Badge variant="outline">
                                        Position: {channel.position}
                                    </Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={() => fetchMessages(channel.id)}
                                    disabled={channelData.get(channel.id)?.loading}
                                    className="cursor-pointer"
                                >
                                    {channelData.get(channel.id)?.loading ? "Fetching..." : "Fetch Messages in Last Hour"}
                                </Button>
                                {channelData.get(channel.id)?.messages.length ? (
                                    <Button
                                        onClick={() => generateChannelReport(channel.id)}
                                        disabled={channelReports.get(channel.id)?.loading}
                                        variant="secondary"
                                        className="cursor-pointer"
                                    >
                                        {channelReports.get(channel.id)?.loading ? "Generating..." : "Generate Report"}
                                    </Button>
                                ) : null}
                            </div>

                            {/* Report Section */}
                            {(() => {
                                const reportData = channelReports.get(channel.id);
                                if (reportData?.error) {
                                    return (
                                        <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
                                            {reportData.error}
                                        </div>
                                    );
                                }
                                if (reportData?.report) {
                                    return (
                                        <div className="mt-4">
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="report">
                                                    <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer">
                                                        <div className="flex flex-col items-start gap-2 text-left">
                                                            <div className="font-bold">{reportData.report.headline}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Generated: {new Date(reportData.report.timestamp).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="space-y-4 pt-4">
                                                            <div>
                                                                <h3 className="font-semibold mb-2">Report</h3>
                                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{reportData.report.body}</p>
                                                            </div>
                                                            <Separator />
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Messages Section */}
                            {(() => {
                                const data = channelData.get(channel.id);
                                if (data?.messages.length) {
                                    return (
                                        <div className="mt-4">
                                            <Accordion type="single" collapsible className="w-full">
                                                <AccordionItem value="messages">
                                                    <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer bg-muted px-4">
                                                        <div className="flex items-center gap-2">
                                                            Messages
                                                            <Badge variant="secondary" className="ml-2">
                                                                {data.messages.length}
                                                            </Badge>
                                                        </div>
                                                    </AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="space-y-4 pt-4">
                                                            <Accordion type="single" collapsible className="w-full">
                                                                {data.messages.map((message, index) => (
                                                                    <AccordionItem
                                                                        value={`message-${index}`}
                                                                        key={message.id}
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
                                                                ))}
                                                            </Accordion>
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            </Accordion>
                                        </div>
                                    );
                                } else if (data?.messages.length === 0 && !data?.loading) {
                                    return (
                                        <div className="mt-4 p-4 bg-muted/50 text-muted-foreground rounded-lg">
                                            No messages found
                                        </div>
                                    );
                                }
                                return null;
                            })()}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}