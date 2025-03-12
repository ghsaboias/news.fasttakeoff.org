import { fetchExecutiveOrderById, fetchExecutiveOrders } from '@/lib/data/executive-orders';
import { notFound } from 'next/navigation';
import ExecutiveOrderClient from './ExecutiveOrderClient';

// This generates the static paths at build time
export async function generateStaticParams() {
    // Fetch first page of orders to generate static paths
    const { orders } = await fetchExecutiveOrders(1, '2025-01-20');

    // Return the paths
    return orders.map((order) => ({
        id: order.id,
    }));
}

// Make this page static
export const dynamic = 'force-static';
export const revalidate = 3600; // Revalidate every hour

export default async function ExecutiveOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log(`Rendering page for executive order ${id}`);
    const order = await fetchExecutiveOrderById(id);

    if (!order) {
        console.log(`No order found for ${id}, returning not found`);
        notFound();
    }

    console.log(`Successfully fetched order for ${id}, rendering client component`);
    return <ExecutiveOrderClient initialOrder={order} />;
}