'use client';

import dynamic from 'next/dynamic';

// Dynamically import the heavy network visualization component with ssr: false
const NetworkVisualization = dynamic(() => import('./NetworkVisualization'), {
    loading: () => (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
                <p className="mt-4 text-lg">Loading Power Network...</p>
            </div>
        </div>
    ),
    ssr: false // Disable SSR for canvas-based component
});

export default function NetworkVisualizationWrapper() {
    return <NetworkVisualization />;
}