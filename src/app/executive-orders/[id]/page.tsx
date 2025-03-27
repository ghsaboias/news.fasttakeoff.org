import { fetchExecutiveOrderById } from '@/lib/data/executive-orders';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ExecutiveOrderClient from './ExecutiveOrderClient';

export default async function ExecutiveOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log(`Rendering page for executive order ${id}`);
    const { env } = getCacheContext();
    const order = await fetchExecutiveOrderById(id, env);
    if (!order) {
        console.log(`No order found for ${id}, triggering notFound`);
        notFound();
    }
    console.log(`Successfully fetched order for ${id}, rendering client component`);
    return <ExecutiveOrderClient initialOrder={order} />;
}