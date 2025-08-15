'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { PropsWithChildren } from 'react';

// Public paths that don't need authentication
const PUBLIC_PATHS = [
    '/',
    '/news-globe',
    '/brazil',
    '/current-events',
    '/executive-orders',
    '/rss',
];

export default function AuthProvider({ children }: PropsWithChildren) {
    const pathname = usePathname();

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
                    baseTheme: dark,
                    variables: {
                        // Primary colors - reuse app's industrial theme
                        colorPrimary: 'var(--primary)',

                        // Background colors - reuse app's dark theme
                        colorBackground: 'var(--background)',
                        colorInputBackground: 'var(--input)',

                        // Text colors - reuse app's text colors
                        colorText: 'var(--foreground)',
                        colorInputText: 'var(--foreground)',

                        // Typography - reuse app's font
                        fontFamily: 'var(--font-sans)',

                        // Border radius - reuse app's radius
                        borderRadius: 'var(--radius)',
                    },
                    layout: {
                        socialButtonsVariant: 'iconButton',
                        showOptionalFields: false,
                        privacyPageUrl: '/privacy-policy',
                    }
                }}
            >
                {children}
            </ClerkProvider>
        </>
    );
} 