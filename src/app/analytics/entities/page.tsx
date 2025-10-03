import { Metadata } from 'next';
import dynamic from 'next/dynamic';

// Dynamically import the entities client component
const EntitiesClient = dynamic(() => import('./EntitiesClient'), {
    loading: () => (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading entities...</span>
        </div>
    ),
    ssr: true // Keep SSR for content
});

export const metadata: Metadata = {
    title: 'Entities - Fast Takeoff',
    description: 'Explore key entities mentioned in news reports',
    keywords: 'entities, people, organizations, locations, news analysis',
};

export default function EntitiesPage() {
    return <EntitiesClient />;
} 