import type { Order } from '../components/Orders';
import Orders from '../components/Orders';

// Orders will be injected at build time as const orders = [...]
// @ts-ignore: 'orders' is injected at build time
const orders: Order[] = [] as any; // Placeholder, replaced by injection

export default function OrdersPage() {
    return (
        <main className="min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-6">Executive Orders</h1>
            <Orders initialOrders={orders} />
        </main>
    )
}