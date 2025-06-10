'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { usePathname } from 'next/navigation';
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
    const [isAuthRequired, setIsAuthRequired] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check if current path requires auth
        const needsAuth = !PUBLIC_PATHS.some(path =>
            pathname === path || pathname.startsWith(`${path}/`)
        );

        setIsAuthRequired(needsAuth);
        setIsLoading(false);
    }, [pathname]);

    // Show nothing while determining auth requirement
    if (isLoading) {
        return null;
    }

    // If auth is not required, render children directly
    if (!isAuthRequired) {
        return <>{children}</>;
    }

    // If auth is required, wrap with ClerkProvider
    return (
        <ClerkProvider>{children}</ClerkProvider>
    );
} 