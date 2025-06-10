'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';

export default function ThirdPartyScripts() {
    const [shouldLoad, setShouldLoad] = useState(false);

    useEffect(() => {
        // Load scripts after user interaction or 3 seconds
        const timer = setTimeout(() => setShouldLoad(true), 3000);

        const handleInteraction = () => {
            setShouldLoad(true);
            clearTimeout(timer);
        };

        // Listen for any user interaction
        window.addEventListener('scroll', handleInteraction, { once: true });
        window.addEventListener('click', handleInteraction, { once: true });
        window.addEventListener('touchstart', handleInteraction, { once: true });

        return () => {
            clearTimeout(timer);
            window.removeEventListener('scroll', handleInteraction);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('touchstart', handleInteraction);
        };
    }, []);

    if (!shouldLoad) {
        return null;
    }

    return (
        <>
            {/* Google Analytics */}
            <Script
                src="https://www.googletagmanager.com/gtag/js?id=G-ZZQ4KRK7H5"
                strategy="worker"
                async
            />
            <Script id="google-analytics" strategy="worker">
                {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-ZZQ4KRK7H5');
        `}
            </Script>

            {/* Google News Showcase */}
            <Script
                src="https://news.google.com/swg/js/v1/swg-basic.js"
                strategy="worker"
                async
            />
            <Script id="google-news-showcase" strategy="worker">
                {`
          (self.SWG_BASIC = self.SWG_BASIC || []).push(basicSubscriptions => {
            basicSubscriptions.init({
              type: "NewsArticle",
              isPartOfType: ["Product"],
              isPartOfProductId: "CAownKXbCw:openaccess",
              clientOptions: { theme: "light", lang: "en" },
            });
          });
        `}
            </Script>
        </>
    );
} 