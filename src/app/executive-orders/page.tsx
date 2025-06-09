import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { getStartDate } from "@/lib/utils";
import ClientExecutiveOrders from './ExecutiveOrdersClient';

export const revalidate = 3600; // Every hour

export async function generateMetadata() {
    return {
        title: 'Executive Orders - Fast Takeoff News',
        description: 'Latest executive orders and presidential directives.',
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