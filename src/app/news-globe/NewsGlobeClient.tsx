'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the NewsGlobe component
const NewsGlobe = dynamic(
    () => import('@/components/NewsGlobe'),
    {
        loading: () => (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
                    <p className="mt-4 text-lg">Loading 3D Globe...</p>
                </div>
            </div>
        ),
        ssr: false // Disable server-side rendering for Three.js
    }
);

export default function NewsGlobeClient() {
    return (
        <Suspense fallback={null}>
            <NewsGlobe />
        </Suspense>
    );
} 