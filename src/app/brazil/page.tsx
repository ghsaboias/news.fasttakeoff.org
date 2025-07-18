import { SummaryDisplay } from './SummaryDisplay';

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