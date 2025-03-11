'use client'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { fetchExecutiveOrders, type ExecutiveOrder } from "@/lib/data/executive-orders"
import { getStartDate } from "@/lib/utils"
import Link from "next/link"
import { useEffect, useState } from "react"

export default function ExecutiveOrdersPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [executiveOrders, setExecutiveOrders] = useState<ExecutiveOrder[]>([])
    const [loading, setLoading] = useState(true)
    const ordersPerPage = 6
    const startDate = getStartDate(0.3)

    useEffect(() => {
        async function loadExecutiveOrders() {
            try {
                const { orders } = await fetchExecutiveOrders(1, startDate)
                setExecutiveOrders(orders)
            } catch (error) {
                console.error("Error fetching executive orders:", error)
            } finally {
                setLoading(false)
            }
        }

        loadExecutiveOrders()
    }, [startDate])

    // Filter executive orders based on search query
    const filteredOrders = executiveOrders.filter((order) => {
        const matchesSearch = order.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.summary.toLowerCase().includes(searchQuery.toLowerCase())

        return matchesSearch
    })

    // Pagination logic
    const indexOfLastOrder = currentPage * ordersPerPage
    const indexOfFirstOrder = indexOfLastOrder - ordersPerPage
    const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder)
    const totalPages = Math.ceil(filteredOrders.length / ordersPerPage)

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-lg font-medium">Loading executive orders...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Executive Orders</h1>
                    <p className="mt-2 text-lg text-muted-foreground">
                        Browse and search executive orders related to technology, AI, and innovation.
                    </p>
                </div>

                {/* Search */}
                <div className="flex flex-col gap-4 md:flex-row">
                    <div className="flex-1">
                        <Input
                            placeholder="Search executive orders..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value)
                                setCurrentPage(1) // Reset to first page on new search
                            }}
                            className="w-full"
                        />
                    </div>
                </div>

                <Separator />

                {/* Results count */}
                <div>
                    <p className="text-sm text-muted-foreground">
                        Showing {filteredOrders.length} executive order{filteredOrders.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Executive Orders Grid */}
                {filteredOrders.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {currentOrders.map((order) => (
                            <Card key={order.id}>
                                <CardHeader>
                                    <div className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium mb-2">
                                        {order.category}
                                    </div>
                                    <CardTitle className="line-clamp-2">{order.title}</CardTitle>
                                    <CardDescription>{order.date}</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <p className="line-clamp-3 text-sm text-muted-foreground">{order.summary}</p>
                                </CardContent>
                                <CardFooter>
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/executive-orders/${order.id}`}>Read more</Link>
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-lg font-medium">No executive orders found</p>
                        <p className="text-muted-foreground">Try adjusting your search</p>
                    </div>
                )}

                {/* Pagination */}
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
    )
}
