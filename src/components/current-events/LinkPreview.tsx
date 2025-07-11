"use client"

import { useApi } from "@/lib/hooks";
import { LinkPreview as LinkPreviewType } from "@/lib/types/core";
import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

interface LinkPreviewProps {
    url: string;
    className?: string;
}

export default function LinkPreview({ url, className = "" }: LinkPreviewProps) {
    const { data: preview, loading, error } = useApi<LinkPreviewType>(
        () => fetch(`/api/link-preview?url=${encodeURIComponent(url)}`).then(res => res.json()),
        { manual: false }
    );

    const displayUrl = useMemo(() => {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }, [url]);

    if (loading) {
        return (
            <div className={`border rounded-lg p-3 animate-pulse ${className}`}>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-300 rounded"></div>
                    <div className="w-24 h-4 bg-gray-300 rounded"></div>
                </div>
                <div className="mt-2 w-full h-3 bg-gray-300 rounded"></div>
                <div className="mt-1 w-3/4 h-3 bg-gray-300 rounded"></div>
            </div>
        );
    }

    if (error || !preview) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm hover:underline ${className}`}
            >
                <ExternalLink className="h-3 w-3" />
                {displayUrl}
            </a>
        );
    }

    const hasRichContent = preview.title || preview.description || preview.image;

    if (!hasRichContent) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm hover:underline ${className}`}
            >
                <ExternalLink className="h-3 w-3" />
                {preview.siteName || displayUrl}
            </a>
        );
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block border rounded-lg p-3 hover:bg-gray-50 transition-colors ${className}`}
        >
            <div className="flex gap-3">
                {preview.image && (
                    <div className="flex-shrink-0">
                        <Image
                            src={preview.image}
                            alt={preview.title || preview.siteName || displayUrl}
                            width={64}
                            height={64}
                            className="w-16 h-16 object-cover rounded"
                            unoptimized
                        />
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                        <ExternalLink className="h-3 w-3" />
                        <span>{preview.siteName || displayUrl}</span>
                    </div>
                    {preview.title && (
                        <h4 className="font-medium text-sm text-gray-900 line-clamp-2 mb-1">
                            {preview.title}
                        </h4>
                    )}
                    {preview.description && (
                        <p className="text-xs text-gray-600 line-clamp-2">
                            {preview.description}
                        </p>
                    )}
                </div>
            </div>
        </a>
    );
} 