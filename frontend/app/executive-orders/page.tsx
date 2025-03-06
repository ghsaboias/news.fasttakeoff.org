import Orders from '../components/Orders';
import { orders } from './orders-data';

export default function OrdersPage() {
    return (
        <main className="min-h-screen p-4">
            <h1 className="text-2xl font-bold mb-6">Executive Orders</h1>
            <Orders initialOrders={orders} />
        </main>
    )
}