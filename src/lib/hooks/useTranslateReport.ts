import { useCallback, useEffect, useRef, useState } from 'react';
import { TranslationResponse } from '../types/external-apis';

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

    // Use refs for callback functions to avoid unnecessary re-renders
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);

    // Update refs when callbacks change
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
    }, [onSuccess, onError]);

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

            const newTranslatedContent = await response.json() as TranslationResponse;
            setTranslatedContent(newTranslatedContent);

            if (onSuccessRef.current) {
                onSuccessRef.current(newTranslatedContent);
            }
        } catch (error) {
            console.error('Translation error:', error);
            setTranslatedContent(null);

            if (onErrorRef.current) {
                onErrorRef.current(error instanceof Error ? error : new Error('Translation failed'));
            }
        } finally {
            setIsTranslating(false);
        }
    }, [report, selectedLanguage]); // Removed onSuccess and onError from dependencies

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
