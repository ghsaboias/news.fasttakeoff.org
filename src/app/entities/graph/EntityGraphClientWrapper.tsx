'use client';

import dynamic from 'next/dynamic';

// Dynamically import the heavy entity graph visualization component with ssr: false
const EntityGraphClient = dynamic(() => import('./EntityGraphClient'), {
    loading: () => (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
                <p className="mt-4 text-lg">Loading Entity Graph...</p>
            </div>
        </div>
    ),
    ssr: false // Disable SSR for canvas-based component
});

export default function EntityGraphClientWrapper() {
    return <EntityGraphClient />;
}