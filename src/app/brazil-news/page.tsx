import { SummaryDisplay } from './SummaryDisplay';

export const revalidate = 3600; // Revalidate every hour

export default async function BRNewsPage() {
    return (
        <div className="px-4 flex flex-col items-center w-[90vw]">
            <SummaryDisplay />
        </div>
    );
} 