'use client';

import OrderCard from "@/components/executive-orders/OrderCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchExecutiveOrders } from "@/lib/data/executive-orders";
import { useApi } from "@/lib/hooks";
import { ExecutiveOrder } from "@/lib/types/executive-orders";
import { getStartDate } from "@/lib/utils";
import { useCallback, useMemo, useState } from "react";

export default function ClientExecutiveOrders({ initialOrders }: { initialOrders: ExecutiveOrder[] }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const ordersPerPage = 6;
    const startDate = getStartDate(0.3);

    const fetcher = useCallback(() => fetchExecutiveOrders(1, startDate), [startDate]);

    const { data: fetchedOrders, loading } = useApi<{ orders: ExecutiveOrder[] }>(
        fetcher,
        { manual: initialOrders.length > 0 }
    );

    const executiveOrders = useMemo(() => fetchedOrders?.orders || initialOrders, [fetchedOrders, initialOrders]);

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
            <div className="mb-8">
                <Skeleton className="h-8 w-64 mb-4" />
                <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-6">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="border rounded-lg p-6 bg-card">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-6 w-24" />
                                    <Skeleton className="h-5 w-32" />
                                </div>
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                            <div className="ml-4 flex flex-col items-end gap-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                        </div>
                    </div>
                ))}
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