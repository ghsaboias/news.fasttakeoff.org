import Orders from '../components/Orders';

// This will be replaced by the inject-orders script at build time
export const orders = [];

export default function OrdersPage() {
    return (
        <main className="min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-6">Executive Orders</h1>
            <Orders initialOrders={orders} />
        </main>
    )
} 