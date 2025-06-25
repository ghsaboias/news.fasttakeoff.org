'use client';

import { detectTelegramUrls, extractTelegramPost } from '@/lib/utils';
import { useEffect, useRef } from 'react';

// Extend Window interface for Telegram widgets
declare global {
    interface Window {
        telegramLoaded?: boolean;
    }
}

interface TelegramEmbedProps {
    content: string;
    className?: string;
}

// Global flag to track if Telegram script is loaded
let telegramScriptLoaded = false;

export default function TelegramEmbed({ content, className = '' }: TelegramEmbedProps) {
    const telegramUrls = detectTelegramUrls(content);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (telegramUrls.length === 0 || !containerRef.current) return;

        const container = containerRef.current;

        // Clear any existing content
        container.innerHTML = '';

        // Load Telegram widget script first (if not already loaded)
        if (!document.querySelector('script[src*="telegram-widget.js"]')) {
            const globalScript = document.createElement('script');
            globalScript.src = 'https://telegram.org/js/telegram-widget.js?22';
            globalScript.async = true;
            document.head.appendChild(globalScript);
        }

        // Create embed containers for each Telegram URL
        telegramUrls.forEach((url, index) => {
            const telegramPost = extractTelegramPost(url);
            if (!telegramPost) return;

            // Create a container div for this embed
            const embedDiv = document.createElement('div');
            embedDiv.className = 'telegram-widget-container mb-4';
            embedDiv.id = `widget-container-${telegramPost.replace('/', '-')}-${index}`;

            // Create script element - let Telegram script create the iframe automatically
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.async = true;
            script.setAttribute('data-telegram-post', telegramPost);
            script.setAttribute('data-width', '100%');

            // Append only the script - it will create the iframe
            embedDiv.appendChild(script);

            // Append embed div to main container
            container.appendChild(embedDiv);
        });

    }, [telegramUrls]);

    if (telegramUrls.length === 0) return null;

    return (
        <div className={`space-y-4 ${className}`}>
            <div ref={containerRef} />
        </div>
    );
} 