import type { Order } from '../components/Orders';
import Orders from '../components/Orders';

// Declare the injected orders variable
declare const orders: Order[];

// Orders will be injected at build time

export default function OrdersPage() {
    return (
        <main className="min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-6">Executive Orders</h1>
            <Orders initialOrders={orders} />
        </main>
    )
}