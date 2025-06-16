"use client"

import NotFound from '@/app/not-found';
import MessageItem from "@/components/current-events/MessageItem";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader } from "@/components/ui/loader";
import { LocalDateTimeFull } from "@/components/utils/LocalDateTime";
import { DiscordMessage, Report } from "@/lib/types/core";
import { ArrowLeft, Check, Globe, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster, toast } from 'sonner';

interface TranslatedContent {
    headline?: string;
    city?: string;
    body: string;
}

const LANGUAGES = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese'
} as const;

type LanguageCode = keyof typeof LANGUAGES;

export default function ReportClient() {
    const params = useParams();
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;
    const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;
    console.log(channelId, reportId);

    const [report, setReport] = useState<Report | null>(null);
    const [allMessages, setAllMessages] = useState<DiscordMessage[]>([]);
    const [displayedMessages, setDisplayedMessages] = useState<DiscordMessage[]>([]);
    const [messageCount, setMessageCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
    const [translatedContent, setTranslatedContent] = useState<TranslatedContent | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [notFound, setNotFound] = useState(false);

    const SOURCES_PER_PAGE = 20;

    useEffect(() => {
        const fetchReportAndMessages = async () => {
            setIsLoading(true);
            const reportResponse = await fetch(`/api/reports?channelId=${channelId}&reportId=${reportId}`);
            if (!reportResponse.ok) {
                if (reportResponse.status === 404) {
                    setNotFound(true);
                    setIsLoading(false);
                    return;
                }
                throw new Error('Failed to fetch report');
            }
            const data = await reportResponse.json();
            setReport(data.report);
            setAllMessages(data.messages);
            setDisplayedMessages(data.messages.slice(0, SOURCES_PER_PAGE));
            setMessageCount(data.messages.length);
            setCurrentPage(1);
            setIsLoading(false);
        };
        fetchReportAndMessages();
    }, [channelId, reportId]);

    useEffect(() => {
        const translateReport = async () => {
            if (!report || selectedLanguage === 'en') {
                setTranslatedContent(null);
                return;
            }

            setIsTranslating(true);
            const toastId = toast.loading(`Translating to ${LANGUAGES[selectedLanguage]}...`);

            try {
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        headline: report.headline,
                        city: report.city,
                        body: report.body,
                        targetLang: selectedLanguage,
                    }),
                });

                if (!response.ok) throw new Error('Failed to translate report');
                const { translatedContent } = await response.json();
                setTranslatedContent(translatedContent);
                toast.success(`Translated to ${LANGUAGES[selectedLanguage]}`, {
                    id: toastId,
                });
            } catch (error) {
                console.error('Translation error:', error);
                setTranslatedContent(null);
                toast.error('Translation failed. Please try again.', {
                    id: toastId,
                });
            } finally {
                setIsTranslating(false);
            }
        };

        translateReport();
    }, [report, selectedLanguage]);

    const paragraphs = report?.body.split('\n\n').filter(Boolean);

    const loadMore = () => {
        const nextPage = currentPage + 1;
        const end = nextPage * SOURCES_PER_PAGE;
        setDisplayedMessages(allMessages.slice(0, end));
        setCurrentPage(nextPage);
    };

    const hasMore = displayedMessages.length < messageCount;

    if (notFound) {
        return <NotFound />;
    }

    return (
        <>
            <div className="p-6 mx-autoflex flex-col w-[95vw]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader size="xl" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-2 justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:space-y-0 sm:gap-4 sm:w-full">
                                <div className="flex items-center gap-3">
                                    <Button asChild variant="outline" className="min-w-[40px] flex justify-center">
                                        <Link href={`/current-events/${channelId}`}>
                                            <ArrowLeft className="h-4 w-4" />
                                        </Link>
                                    </Button>
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
                                {report?.generatedAt ? ' - ' : ''}{translatedContent?.city || report?.city}
                            </p>
                            <div className="prose prose-zinc max-w-none overflow-y-auto text-justify">
                                {translatedContent ? (
                                    translatedContent.body.split('\n\n').filter(Boolean).map((paragraph, index) => (
                                        <p key={index} className="mb-2 last:mb-0">{paragraph}</p>
                                    ))
                                ) : (
                                    paragraphs?.map((paragraph, index) => (
                                        <p key={index} className="mb-2 last:mb-0">{paragraph}</p>
                                    ))
                                )}
                            </div>
                        </div>
                        {allMessages.length > 0 && (
                            <div className="flex flex-col gap-0">
                                <div className="border-b border-border" />
                                <div className="flex flex-col">
                                    {displayedMessages.map((message, index) => (
                                        <MessageItem key={message.id} message={message} index={index} />
                                    ))}
                                </div>
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