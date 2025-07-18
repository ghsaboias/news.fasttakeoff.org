import { useCallback, useEffect, useState } from 'react';

interface TranslatedContent {
    headline?: string;
    city?: string;
    body: string;
}

interface Report {
    headline: string;
    city: string;
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

interface UseTranslateReportOptions {
    onSuccess?: (translatedContent: TranslatedContent) => void;
    onError?: (error: Error) => void;
}

interface UseTranslateReportState {
    translatedContent: TranslatedContent | null;
    isTranslating: boolean;
    selectedLanguage: LanguageCode;
    setSelectedLanguage: (language: LanguageCode) => void;
    LANGUAGES: typeof LANGUAGES;
}

export function useTranslateReport(
    report: Report | null,
    options: UseTranslateReportOptions = {}
): UseTranslateReportState {
    const { onSuccess, onError } = options;

    const [translatedContent, setTranslatedContent] = useState<TranslatedContent | null>(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');

    const translateReport = useCallback(async () => {
        if (!report || selectedLanguage === 'en') {
            setTranslatedContent(null);
            return;
        }

        setIsTranslating(true);

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

            if (!response.ok) {
                throw new Error('Failed to translate report');
            }

            const { translatedContent: newTranslatedContent } = await response.json();
            setTranslatedContent(newTranslatedContent);

            if (onSuccess) {
                onSuccess(newTranslatedContent);
            }
        } catch (error) {
            console.error('Translation error:', error);
            setTranslatedContent(null);

            if (onError) {
                onError(error instanceof Error ? error : new Error('Translation failed'));
            }
        } finally {
            setIsTranslating(false);
        }
    }, [report, selectedLanguage, onSuccess, onError]);

    useEffect(() => {
        translateReport();
    }, [translateReport]);

    return {
        translatedContent,
        isTranslating,
        selectedLanguage,
        setSelectedLanguage,
        LANGUAGES
    };
}

export type { LanguageCode, TranslatedContent };
