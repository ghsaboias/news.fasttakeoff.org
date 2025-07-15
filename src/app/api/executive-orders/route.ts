import { withErrorHandling } from '@/lib/api-utils';
import { fetchExecutiveOrders } from '@/lib/data/executive-orders';
import { getStartDate } from '@/lib/utils';

/**
 * GET /api/executive-orders
 * Fetches the 3 most recent executive orders from the Federal Register.
 * @returns {Promise<NextResponse<ExecutiveOrder[]>>}
 * @throws 500 if fetching or sorting fails.
 * @auth None required.
 */
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