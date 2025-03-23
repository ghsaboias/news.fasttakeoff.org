"use client";

import MessageItem from "@/components/current-events/MessageItem";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DiscordChannel, DiscordMessage, Report } from "@/lib/types/core";
import { ArrowLeft, Clock, MessageSquare, RefreshCw } from "lucide-react";
import Link from "next/link";
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

    const generateChannelReport = async () => {
        setChannelReport(prev => ({ ...prev, loading: true, error: null }));
        try {
            const response = await fetch('/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channelId: channel.id, timeframe: '1h' }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to generate report: ${response.status} - ${errorText}`);
            }
            const { report: newReport } = await response.json() as { report: Report };
            setChannelReport({ report: newReport, loading: false, error: null });
        } catch (error) {
            console.error('Error generating report:', error);
            setChannelReport({
                report: null,
                loading: false,
                error: error instanceof Error ? error.message : 'Failed to generate report'
            });
        }
    };

    const fetchMessages = async () => {
        setChannelData(prev => ({ ...prev, loading: true }));
        try {
            const response = await fetch(`/api/channels/${channel.id}/messages`);
            if (!response.ok) throw new Error(`Failed to fetch messages: ${response.status}`);
            const data = await response.json() as { count: number, messages: DiscordMessage[] };

            setChannelData({
                count: data.count,
                messages: data.messages,
                loading: false
            });
        } catch (error) {
            console.error(`Error fetching messages for channel ${channel.id}:`, error);
            setChannelData({
                count: 0,
                messages: [],
                loading: false
            });
        }
    };

    // Format report text with paragraph breaks
    const formatReportText = (text: string) => {
        // Split by double newlines or single newlines, ensuring paragraphs are separated
        const paragraphs = text.split(/\n{2,}|\n/).filter(p => p.trim().length > 0);

        return paragraphs.map((paragraph, index) => (
            <p key={index} className="mb-6 last:mb-0 leading-7 text-justify">{paragraph}</p>
        ));
    };

    console.log(channelReport.report);

    return (
        <div className="container py-8 px-8 max-w-5xl">
            <div className="flex flex-col gap-8">
                {/* Navigation */}
                <Button asChild variant="ghost" size="sm" className="self-start">
                    <Link href="/current-events" className="flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Link>
                </Button>

                {/* Error Message */}
                {channelReport.error && (
                    <div className="p-4 bg-destructive-light text-destructive rounded-lg">
                        {channelReport.error}
                    </div>
                )}

                {/* Report Section */}
                {channelReport.report && (
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold tracking-tight">{channel.name}</h3>
                            <h1 className="text-2xl font-bold">{channelReport.report.headline.toUpperCase()}</h1>
                            <h2 className="text-lg font-medium text-muted-foreground">{channelReport.report.city}</h2>
                            <div className="prose prose-zinc max-w-none">
                                {formatReportText(channelReport.report.body)}
                            </div>
                        </div>
                    </div>
                )}

                {/* Channel Information */}
                <div className="space-y-2">
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {channelData.count > 0 && (
                            <div className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" />
                                <span>{channelData.count} messages</span>
                            </div>
                        )}
                        {channelReport.report?.timestamp && (
                            <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>Generated: {new Date(channelReport.report.timestamp).toISOString().substring(0, 19).replace('T', ' ')}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                    <Button
                        onClick={fetchMessages}
                        disabled={channelData.loading}
                        variant="outline"
                        size="sm"
                        className="flex gap-2 items-center"
                    >
                        {channelData.loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        {channelData.loading ? "Refreshing Sources..." : "Refresh Sources"}
                    </Button>
                    <Button
                        onClick={generateChannelReport}
                        disabled={channelReport.loading}
                        variant="outline"
                        size="sm"
                        className="flex gap-2 items-center"
                    >
                        {channelReport.loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        {channelReport.loading ? "Regenerating Report..." : "Regenerate Report"}
                    </Button>
                </div>

                {/* Sources Section */}
                <Accordion type="single" collapsible className="w-full bg-gray-100 p-4 rounded-lg">
                    <AccordionItem value="sources">
                        <AccordionTrigger className="text-xl font-semibold hover:no-underline py-0">
                            <div className="flex items-center gap-2">
                                <p className="text-lg font-semibold">
                                    Sources
                                    {channelData.count > 0 && (
                                        <span className="text-md ml-4">
                                            {channelData.messages.length}
                                        </span>
                                    )}
                                </p>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            {channelData.messages.length > 0 ? (
                                <div className="space-y-2">
                                    {channelData.messages.map((message, index) => (
                                        <div key={message.id}>
                                            <div className={`bg-muted-light p-4 rounded-md`}>
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
                                    {channelData.loading ?
                                        "Loading sources..." :
                                        "No messages found. Click 'Refresh Sources' to load the latest messages."}
                                </div>
                            )}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );
} 