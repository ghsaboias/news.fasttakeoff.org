"use client";

import MessageItem from "@/components/current-events/MessageItem";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { DiscordChannel, DiscordMessage, Report } from "@/lib/types/core";
import { Clock, MessageSquare } from "lucide-react";
import { useState } from 'react';

interface ChannelDetailClientProps {
    channel: DiscordChannel;
    report: Report | null;
    messages: { count: number; messages: DiscordMessage[] };
}

export default function ChannelDetailClient({ channel, report, messages }: ChannelDetailClientProps) {
    const [channelReport, setChannelReport] = useState<{ report: Report | null; loading: boolean; error: string | null }>({
        report: report || null,
        loading: false,
        error: null
    });
    const [channelData, setChannelData] = useState<{
        count: number;
        messages: DiscordMessage[];
        loading: boolean
    }>({
        count: messages.count,
        messages: messages.messages,
        loading: false
    });

    const formatReportText = (text: string) => {
        const paragraphs = text.split(/\n{2,}|\n/).filter(p => p.trim().length > 0);
        return paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-4 last:mb-0 leading-7 text-justify">{paragraph}</p>
        ));
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <div className="flex flex-col space-y-4">
                {channelReport.error && (
                    <div className="p-4 bg-destructive-light text-destructive rounded-lg">
                        {channelReport.error}
                    </div>
                )}

                {channelReport.report && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center gap-2">
                                <h3 className="text-xl font-bold tracking-tight">{channel.name}</h3>
                            </div>
                            <h1 className="text-2xl font-bold">{channelReport.report.headline.toUpperCase()}</h1>
                            <h2 className="text-lg font-medium text-muted-foreground">{channelReport.report.city}</h2>
                            <div className="prose prose-zinc max-w-none">
                                {formatReportText(channelReport.report.body)}
                            </div>
                        </div>
                    </div>
                )}


                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {channelData.count > 0 && (
                        <div className="flex items-center gap-1">
                            <MessageSquare className="h-4 w-4" />
                            <span>{channelData.count} updates</span>
                        </div>
                    )}
                    {channelReport.report?.timestamp && (
                        <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>Generated: {new Date(channelReport.report.timestamp).toISOString().substring(0, 19).replace('T', ' ')}</span>
                        </div>
                    )}
                </div>

                <Accordion type="single" collapsible className="w-full bg-gray-100 p-4 rounded-lg">
                    <AccordionItem value="sources">
                        <AccordionTrigger className="text-xl font-semibold hover:no-underline py-0 items-center">
                            <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold">
                                    Sources
                                    {channelData.count > 0 && (
                                        <span className="text-md ml-4">{channelData.messages.length}</span>
                                    )}
                                </p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            {channelData.messages.length > 0 ? (
                                <div className="space-y-2">
                                    {channelData.messages.map((message, index) => (
                                        <div key={message.id}>
                                            <div className="bg-muted-light p-4 rounded-md">
                                                <MessageItem message={message} index={index} noAccordion={true} />
                                            </div>
                                            {index < channelData.messages.length - 1 && (
                                                <Separator className="my-3 bg-gray-300" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-muted-light text-muted-foreground rounded-lg mt-4">
                                    {channelData.loading ? "Loading sources..." : "No messages found."}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
}