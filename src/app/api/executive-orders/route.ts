import { withErrorHandling } from '@/lib/api-utils';
import { fetchExecutiveOrders } from '@/lib/data/executive-orders';
import { getStartDate } from '@/lib/utils';

export async function GET() {
    return withErrorHandling(async () => {
        const startDate = getStartDate(1);
        const { orders } = await fetchExecutiveOrders(1, startDate);
        const sortedOrders = [...orders].sort((a, b) => {
            const dateA = a.publication.publicationDate || a.date;
            const dateB = b.publication.publicationDate || b.date;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
        return sortedOrders.slice(0, 3);
    }, 'Failed to fetch executive orders');
} 