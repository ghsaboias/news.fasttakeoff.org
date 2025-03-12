import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { getStartDate } from "@/lib/utils";
import ClientExecutiveOrders from './ExecutiveOrdersClient';

export const revalidate = 3600; // Revalidate every hour

async function getInitialData() {
    const data = await fetchExecutiveOrders(1, getStartDate(0.3));
    return data.orders;
}

export default async function ExecutiveOrdersPage() {
    const initialOrders = await getInitialData();
    return <ClientExecutiveOrders initialOrders={initialOrders} />;
}