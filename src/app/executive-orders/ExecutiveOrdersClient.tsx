'use client';

import OrderCard from "@/components/executive-orders/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { Separator } from "@/components/ui/separator";
import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { ExecutiveOrder } from "@/lib/types/core";
import { getStartDate } from "@/lib/utils";
import { useEffect, useState } from "react";

export default function ClientExecutiveOrders({ initialOrders }: { initialOrders: ExecutiveOrder[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [executiveOrders, setExecutiveOrders] = useState(initialOrders);
    const [loading, setLoading] = useState(false);
    const ordersPerPage = 6;
    const startDate = getStartDate(0.3);

    useEffect(() => {
        async function loadExecutiveOrders() {
            setLoading(true);
            try {
                const { orders } = await fetchExecutiveOrders(1, startDate);
                setExecutiveOrders(orders);
            } catch (error) {
                console.error("Error fetching executive orders:", error);
            } finally {
                setLoading(false);
            }
        }
        if (initialOrders.length === 0) loadExecutiveOrders();
    }, [startDate, initialOrders]);

    const filteredOrders = executiveOrders.filter((order) =>
        order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.summary.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const indexOfLastOrder = currentPage * ordersPerPage;
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

    if (loading) return (
        <div className="container mx-auto px-4 py-8">
            <div className="col-span-full text-center py-16 flex flex-col items-center justify-center gap-4">
                <Loader size="lg" />
                <p className="text-lg text-muted-foreground">Loading executive orders...</p>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Executive Orders</h1>
                    <p className="mt-2 text-lg text-muted-foreground">
                        Browse and search executive orders.
                    </p>
                </div>
                <div className="flex flex-col gap-4 md:flex-row">
                    <Input
                        placeholder="Search executive orders..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1);
                        }}
                        className="w-full"
                    />
                </div>
                <Separator />
                <div>
                    <p className="text-sm text-muted-foreground">
                        Showing {filteredOrders.length} executive order{filteredOrders.length !== 1 ? 's' : ''}
                    </p>
                </div>
                {filteredOrders.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {currentOrders.map((order) => (
                            <OrderCard key={order.id} order={order} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-lg font-medium">No executive orders found</p>
                        <p className="text-muted-foreground">Try adjusting your search</p>
                    </div>
                )}
                {totalPages > 1 && (
                    <div className="flex justify-center mt-8">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(page)}
                                >
                                    {page}
                                </Button>
                            ))}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}