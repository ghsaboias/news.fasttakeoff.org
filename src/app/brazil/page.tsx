import dynamic from 'next/dynamic';

// Dynamically import the Brazil summary display component
const SummaryDisplay = dynamic(() => import('./SummaryDisplay'), {
    loading: () => (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading Brazil news...</span>
        </div>
    ),
    ssr: true // Keep SSR for content
});

export const revalidate = 3600; // Revalidate every hour

export async function generateMetadata() {
    return {
        title: 'Brazil - Fast Takeoff News',
        description: 'Latest news and updates from Brazil.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/brazil'
        }
    };
}

export default async function BrazilPage() {
    return (
        <div className="px-4 flex flex-col items-center w-[90vw]">
            <SummaryDisplay />
        </div>
    );
} 