'use client';

import dynamic from 'next/dynamic';
import { ComponentProps } from 'react';

// Dynamically import ReactMarkdown to reduce initial bundle size
const ReactMarkdown = dynamic(() => import('react-markdown'), {
    loading: () => (
        <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2 w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
    ),
    ssr: true // Keep SSR for markdown content
});

// Re-export ReactMarkdown with proper typing
export default ReactMarkdown;

// Export the props type for convenience
export type DynamicMarkdownProps = ComponentProps<typeof ReactMarkdown>;