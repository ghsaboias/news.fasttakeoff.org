import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { getStartDate } from "@/lib/utils";
import dynamic from 'next/dynamic';

// Dynamically import the executive orders client component
const ClientExecutiveOrders = dynamic(() => import('./ExecutiveOrdersClient'), {
    loading: () => (
        <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Loading executive orders...</span>
        </div>
    ),
    ssr: true // Keep SSR for content
});

export const revalidate = 3600; // Every hour

export async function generateMetadata() {
    return {
        title: 'Executive Orders - Fast Takeoff News',
        description: 'Latest executive orders and presidential directives.',
        alternates: {
            canonical: 'https://news.fasttakeoff.org/executive-orders'
        }
    };
}

async function getInitialData() {
    const data = await fetchExecutiveOrders(1, getStartDate(0.3));
    return data.orders;
}

export default async function ExecutiveOrdersPage() {
    const initialOrders = await getInitialData();
    return <ClientExecutiveOrders initialOrders={initialOrders} />;
}