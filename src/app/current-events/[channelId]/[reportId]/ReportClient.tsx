"use client"

import NotFound from '@/app/not-found';
import FactCheckDisplay from "@/components/current-events/FactCheckDisplay";
import MessageItem from "@/components/current-events/MessageItem";
import { AttributedReportViewer } from '@/components/source-attribution';
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";
import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { useApi, useTranslateReport, type LanguageCode } from "@/lib/hooks";
import { DiscordMessage, ReportResponse } from "@/lib/types/core";
import {
    ArrowLeft,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Eye,
    EyeOff,
    Globe,
    Loader2,
    MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Toaster, toast } from 'sonner';

const fetchReportAndMessages = async (channelId: string, reportId: string): Promise<ReportResponse> => {
    const response = await fetch(`/api/reports?channelId=${channelId}&reportId=${reportId}`);
    if (!response.ok) {
        if (response.status === 404) {
            // Let the hook handle it, but we can check for this error message
            throw new Error('Not Found');
        }
        throw new Error('Failed to fetch report');
    }
    return response.json();
};

export default function ReportClient() {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;
    const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;

    const fetcher = useCallback(() => {
        if (!channelId || !reportId) {
            return Promise.reject(new Error("Channel ID or Report ID is missing"));
        }
        return fetchReportAndMessages(channelId, reportId);
    }, [channelId, reportId]);

    const { data, loading: isLoading, error } = useApi<ReportResponse>(
        fetcher,
        { manual: !channelId || !reportId }
    );

    const report = useMemo(() => data?.report, [data]);
    const allMessages = useMemo(() => data?.messages || [], [data]);
    const previousReportId = useMemo(() => data?.previousReportId, [data]);
    const nextReportId = useMemo(() => data?.nextReportId, [data]);

    const [displayedMessages, setDisplayedMessages] = useState<DiscordMessage[]>([]);
    const [messageCount, setMessageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [showAttributions, setShowAttributions] = useState(false);
    const [isAttributionsLoading, setIsAttributionsLoading] = useState(false);
    const [showFactCheck, setShowFactCheck] = useState(false);

    const {
        translatedContent,
        isTranslating,
        selectedLanguage,
        setSelectedLanguage,
        LANGUAGES
    } = useTranslateReport(report || null, {
        onSuccess: () => {
            toast.success(`Translated to ${LANGUAGES[selectedLanguage]}`);
        },
        onError: () => {
            toast.error('Translation failed. Please try again.');
        }
    });

    const SOURCES_PER_PAGE = 20;

    useEffect(() => {
        if (allMessages) {
            setDisplayedMessages(allMessages.slice(0, SOURCES_PER_PAGE));
            setMessageCount(allMessages.length);
            setCurrentPage(1);
        }
    }, [allMessages]);



    const loadMore = () => {
        const nextPage = currentPage + 1;
        const end = nextPage * SOURCES_PER_PAGE;
        setDisplayedMessages(allMessages.slice(0, end));
        setCurrentPage(nextPage);
    };

    const hasMore = displayedMessages.length < messageCount;

    if (error?.message === 'Not Found') {
        return <NotFound />;
    }

    return (
        <>
            <div className="p-6 mx-auto flex flex-col">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader size="xl" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 max-w-full sm:max-w-[70%] mx-auto">
                        <div className="flex items-center gap-2 justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:space-y-0 sm:gap-4 sm:w-full">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <Button asChild variant="outline" className="min-w-[40px] flex justify-center">
                                        <Link href={`/current-events/${channelId}`}>
                                            <ArrowLeft className="h-4 w-4" />
                                        </Link>
                                    </Button>

                                    {previousReportId && (
                                        <Button asChild variant="outline" size="icon" title="Previous Report" className="min-w-fit">
                                            <Link href={`/current-events/${channelId}/${previousReportId}`}>
                                                <ChevronLeft className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    )}

                                    {nextReportId && (
                                        <Button asChild variant="outline" size="icon" title="Next Report">
                                            <Link href={`/current-events/${channelId}/${nextReportId}`}>
                                                <ChevronRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    )}

                                    <Button asChild variant="outline" className="hover:bg-accent text-md">
                                        <Link href={`/current-events/${report?.channelId}`}>
                                            {report?.channelName}
                                        </Link>
                                    </Button>
                                    <Button asChild variant="outline" className="min-w-[40px] flex justify-center">
                                        <Link href={`/current-events/${channelId}/messages`}>
                                            <MessageSquare className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="p-2 hover:bg-muted min-w-[64px] flex justify-center">
                                                <div className="flex items-center gap-2">
                                                    <Globe className="h-5 w-5" />
                                                    <span className="text-xs font-medium">{selectedLanguage.toUpperCase()}</span>
                                                </div>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            {(Object.entries(LANGUAGES) as [LanguageCode, string][]).map(([code, name]) => (
                                                <DropdownMenuItem
                                                    key={code}
                                                    onClick={() => setSelectedLanguage(code)}
                                                    className="flex items-center justify-between"
                                                >
                                                    <span>{name}</span>
                                                    {selectedLanguage === code && (
                                                        <Check className="h-4 w-4 text-primary" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setShowAttributions(!showAttributions)}
                                        className="p-2 hover:bg-muted min-w-[64px] flex justify-center"
                                        title={showAttributions ? "Hide Sources" : "Show Sources"}
                                    >
                                        <div className="flex items-center gap-2">
                                            {showAttributions ? (
                                                isAttributionsLoading ? (
                                                    <Loader2 className="h-5 w-5 animate-spin" />
                                                ) : (
                                                    <Eye className="h-5 w-5" />
                                                )
                                            ) : (
                                                <EyeOff className="h-5 w-5" />
                                            )}
                                        </div>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => setShowFactCheck(!showFactCheck)}
                                        className="p-2 hover:bg-muted min-w-[64px] flex justify-center"
                                        title={showFactCheck ? "Hide Fact Check" : "Show Fact Check"}
                                    >
                                        <div className="flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5" />
                                        </div>
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className={`flex flex-col gap-4 transition-opacity duration-200 ${isTranslating ? 'opacity-50' : 'opacity-100'}`}>
                            <h1 className="text-2xl font-bold">
                                {translatedContent?.headline || report?.headline}
                            </h1>
                            <p>
                                {report?.generatedAt && (
                                    <LocalDateTimeFull
                                        dateString={report.generatedAt}
                                        options={{ dateStyle: 'short', timeStyle: 'short' }}
                                    />
                                )}
                                {report?.generatedAt ? ' - ' : ''}{translatedContent?.city || report?.city || ''}
                            </p>
                            {/* Enhanced Interactive Report Body with Source Attribution */}
                            {report && channelId && (
                                <AttributedReportViewer
                                    reportId={report.reportId}
                                    reportBody={translatedContent?.body || report.body}
                                    sourceMessages={allMessages}
                                    channelId={channelId}
                                    className="prose prose-zinc max-w-none overflow-y-auto"
                                    showAttributions={showAttributions}
                                    onLoadingChange={setIsAttributionsLoading}
                                />
                            )}
                            {/* Fact Check Display */}
                            {showFactCheck && report && (
                                <FactCheckDisplay
                                    reportId={report.reportId}
                                    className="mt-4"
                                    onDemandTrigger={true}
                                />
                            )}
                        </div>
                        {allMessages.length > 0 && (
                            <div className="flex flex-col gap-0 border-t border-border">
                                {displayedMessages.map((message) => (
                                    <MessageItem key={message.id} message={message} channelId={channelId} />
                                ))}
                                {hasMore && (
                                    <div className="flex justify-center py-6">
                                        <Button variant="outline" onClick={loadMore}>
                                            Load More
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            <Toaster position="top-right" />
        </>
    );
}