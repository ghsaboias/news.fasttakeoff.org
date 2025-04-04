"use client"

import MessagesAccordion from "@/components/current-events/MessagesAccordion";
import { DiscordMessage, Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ReportClient() {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;
    const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId; // Fix: use reportTimestamp

    const [report, setReport] = useState<Report | null>(null);
    const [messages, setMessages] = useState<DiscordMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReportAndMessages = async () => {
            setIsLoading(true);
            const reportResponse = await fetch(`/api/report?channelId=${channelId}&reportId=${reportId}`);
            if (!reportResponse.ok) throw new Error('Failed to fetch report');
            const data = await reportResponse.json();
            setReport(data.report);
            setMessages(data.messages);
            setIsLoading(false);
        };
        fetchReportAndMessages();
    }, [channelId, reportId]);

    return (
        <div className="p-6 max-w-5xl mx-auto gap-4 flex flex-col">
            <h3>{report?.channelName}</h3>
            {isLoading ? (
                <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold">{report?.headline}</h1>
                    <p className="text-muted-foreground">{formatTime(report?.generatedAt, true)} - {report?.city}</p>
                    <p className="prose prose-zinc max-w-none overflow-y-auto text-justify">{report?.body}</p>
                    <MessagesAccordion
                        channelData={{
                            count: messages.length,
                            messages,
                            loading: isLoading
                        }}
                        isLoading={isLoading}
                    />
                </div>
            )}
        </div>
    );
}