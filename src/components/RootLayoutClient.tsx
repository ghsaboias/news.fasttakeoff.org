'use client';

import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { usePathname } from 'next/navigation';
import React from 'react';

interface RootLayoutClientProps {
    children: React.ReactNode;
}

export default function RootLayoutClient({ children }: RootLayoutClientProps) {
    const pathname = usePathname();
    const showHeaderAndFooter = pathname !== '/news-globe';

    return (
        <>
            {showHeaderAndFooter && <Header />}
            <main className='flex flex-1 justify-center items-start'>{children}</main>
            {showHeaderAndFooter && <Footer />}
        </>
    );
} 