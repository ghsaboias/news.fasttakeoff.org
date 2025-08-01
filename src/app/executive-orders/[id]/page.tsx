import { fetchExecutiveOrderById } from '@/lib/data/executive-orders';
import { getCacheContext } from '@/lib/utils';
import { notFound } from 'next/navigation';
import ExecutiveOrderClient from './ExecutiveOrderClient';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { env } = await getCacheContext();
    const order = await fetchExecutiveOrderById(id, env);

    if (!order) {
        return {
            title: 'Executive Order - Fast Takeoff News',
            description: 'Executive order details',
            alternates: {
                canonical: `https://news.fasttakeoff.org/executive-orders/${id}`
            },
            robots: {
                index: false, // Don't index missing pages
                follow: true
            }
        };
    }

    return {
        title: `${order.title} - Fast Takeoff News`,
        description: order.summary || 'Executive order details',
        alternates: {
            canonical: `https://news.fasttakeoff.org/executive-orders/${id}`
        },
        robots: {
            index: true, // Executive orders are valuable content, keep indexed
            follow: true
        }
    };
}

export default async function ExecutiveOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    console.log(`Rendering page for executive order ${id}`);
    const { env } = await getCacheContext();
    const order = await fetchExecutiveOrderById(id, env);
    if (!order) {
        console.log(`No order found for ${id}, triggering notFound`);
        notFound();
    }
    console.log(`Successfully fetched order for ${id}, rendering client component`);
    return <ExecutiveOrderClient initialOrder={order} />;
}