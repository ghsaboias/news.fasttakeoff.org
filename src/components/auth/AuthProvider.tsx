'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { PropsWithChildren, useEffect, useState } from 'react';

// Public paths that don't need authentication
const PUBLIC_PATHS = [
    '/',
    '/news-globe',
    '/brazil-news',
    '/current-events',
    '/executive-orders',
    '/rss',
];

export default function AuthProvider({ children }: PropsWithChildren) {
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Don't render anything until mounted to prevent hydration issues
    if (!mounted) {
        return null;
    }

    const isPublicPath = PUBLIC_PATHS.some(path =>
        pathname === path || pathname.startsWith(`${path}/`)
    );

    return (
        <>
            {/* Load Clerk script only when needed */}
            {!isPublicPath && (
                <Script
                    src="https://clerk.fasttakeoff.org/npm/@clerk/clerk-js@latest/dist/clerk.browser.js"
                    strategy="lazyOnload"
                />
            )}

            <ClerkProvider
                appearance={{
                    baseTheme: undefined, // Prevent theme loading for public pages
                    variables: { colorPrimary: '#167F6E' }
                }}
            >
                {children}
            </ClerkProvider>
        </>
    );
} 