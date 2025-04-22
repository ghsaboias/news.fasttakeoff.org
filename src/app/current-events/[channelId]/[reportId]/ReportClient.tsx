"use client"

import LinkBadge from "@/components/current-events/LinkBadge";
import MessagesAccordion from "@/components/current-events/MessagesAccordion";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DiscordMessage, Report } from "@/lib/types/core";
import { formatTime } from "@/lib/utils";
import { Check, Globe, Loader2 } from "lucide-react";
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

    const [report, setReport] = useState<Report | null>(null);
    const [messages, setMessages] = useState<DiscordMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
    const [translatedContent, setTranslatedContent] = useState<TranslatedContent | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);

    useEffect(() => {
        const fetchReportAndMessages = async () => {
            setIsLoading(true);
            const reportResponse = await fetch(`/api/reports?channelId=${channelId}&reportId=${reportId}`);
            if (!reportResponse.ok) throw new Error('Failed to fetch report');
            const data = await reportResponse.json();
            setReport(data.report);
            setMessages(data.messages);
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

    return (
        <>
            <div className="p-6 mx-auto gap-4 flex flex-col w-[95vw]">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 justify-between">
                            <div className="flex items-center gap-2">
                                <LinkBadge href={`/current-events/${report?.channelId}`} variant="outline" className="p-2 hover:bg-muted">
                                    {report?.channelName}
                                </LinkBadge>
                                <div className="relative">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="icon" className="p-2 hover:bg-muted min-w-fit">
                                                <div className="flex items-center gap-1">
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
                            <p className="text-muted-foreground">
                                {formatTime(report?.generatedAt, true)} - {translatedContent?.city || report?.city}
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
            <Toaster position="top-right" />
        </>
    );
}