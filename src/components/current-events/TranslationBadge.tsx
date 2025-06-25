import { extractSourceLanguage } from "@/lib/utils/twitter-utils";

interface TranslationBadgeProps {
    footerText?: string;
    className?: string;
}

export default function TranslationBadge({ footerText, className = "" }: TranslationBadgeProps) {
    const sourceLanguage = extractSourceLanguage(footerText);

    if (!sourceLanguage) return null;

    return (
        <div className={`inline-flex items-center gap-1.5 ${className}`}>
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                    />
                </svg>
                {sourceLanguage} → English
            </span>
        </div>
    );
} 