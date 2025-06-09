'use client';

import dynamic from 'next/dynamic';

// Dynamically import NewsGlobe with loading state
const NewsGlobe = dynamic(() => import('@/components/NewsGlobe'), {
    loading: () => (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading 3D Globe...</p>
            </div>
        </div>
    ),
    ssr: false // Disable SSR for Three.js components
});

export default function NewsGlobeClient() {
    return <NewsGlobe />;
} 