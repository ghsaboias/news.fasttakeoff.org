'use client';

import AuthProvider from '@/components/auth/AuthProvider';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import ScrollPopup from '@/components/ScrollPopup';
import { UI } from '@/lib/config';
import { usePathname } from 'next/navigation';
import React from 'react';

interface RootLayoutClientProps {
    children: React.ReactNode;
}

export default function RootLayoutClient({ children }: RootLayoutClientProps) {
    const pathname = usePathname();
    const showHeaderAndFooter = !UI.FULL_SCREEN_PAGES.includes(pathname);

    return (
        <AuthProvider>
            {/* Reserve space for header to prevent layout shift */}
            <div style={{ minHeight: showHeaderAndFooter ? '64px' : '0px' }}>
                {showHeaderAndFooter && <Header />}
            </div>

            <main className='flex flex-1 justify-center items-start'>
                {children}
            </main>

            {/* Reserve space for footer to prevent layout shift */}
            <div style={{ minHeight: showHeaderAndFooter ? '80px' : '0px' }}>
                {showHeaderAndFooter && <Footer />}
            </div>

            {/* Scroll popup appears on all pages */}
            <ScrollPopup scrollThreshold={25} />
        </AuthProvider>
    );
} 