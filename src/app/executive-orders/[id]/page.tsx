export const runtime = 'edge';

import { fetchExecutiveOrderById } from '@/lib/data/executive-orders';
import ExecutiveOrderClient from './ExecutiveOrderClient';

export default async function ExecutiveOrderPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const order = await fetchExecutiveOrderById(id);
    if (!order) {
        return <div>Executive order not found</div>; // Or redirect, but keep it simple for Edge
    }
    return <ExecutiveOrderClient initialOrder={order} />;
}