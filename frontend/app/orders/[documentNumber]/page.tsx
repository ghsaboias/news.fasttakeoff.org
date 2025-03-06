'use client'

import { Order } from '@/app/components/Orders'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function OrderDetail({ params }: { params: { documentNumber: string } }) {
    const [order, setOrder] = useState<Order | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()

    useEffect(() => {
        fetchOrder()
    }, [params.documentNumber])

    const fetchOrder = async () => {
        try {
            const response = await fetch('/api/orders')
            const orders = await response.json()
            const foundOrder = orders.find((o: Order) => o.data?.document_number === params.documentNumber)
            if (foundOrder) {
                setOrder(foundOrder)
            }
        } catch (error) {
            console.error('Error fetching order:', error)
        }
    }

    const handleSummarize = async () => {
        if (!order?.data?.document_number) return

        setLoading(true)
        try {
            const response = await fetch(`/api/summarize/${order.data.document_number}`, {
                method: 'POST'
            })

            if (!response.ok) {
                throw new Error('Failed to generate summary')
            }

            const updatedOrder = await response.json()
            setOrder(updatedOrder)
        } catch (error) {
            console.error('Error generating summary:', error)
        } finally {
            setLoading(false)
        }
    }

    if (!order) {
        return (
            <div className="container mx-auto py-10">
                <div className="text-center text-gray-400">Loading...</div>
            </div>
        )
    }

    return (
        <div className="container mx-auto py-10 space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/" className="inline-block">
                    <Button
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to List
                    </Button>
                </Link>

                <h1 className="text-2xl font-bold text-gray-100">{order.data?.title}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-2 p-6 bg-[#1E293B] border-blue-900/30">
                    <div className="space-y-4">
                        <div className="flex justify-between items-start">
                            <h2 className="text-xl font-semibold text-gray-100 mb-4">Executive Order Details</h2>
                            {order.data?.html_url && (
                                <Link
                                    href={order.data.html_url}
                                    target="_blank"
                                    className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                    <FileText className="h-4 w-4" />
                                    View Original
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            )}
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="text-sm font-medium text-gray-400">Document Number</h3>
                                <p className="text-gray-200">{order.data?.document_number}</p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-gray-400">Publication Date</h3>
                                <p className="text-gray-200">
                                    {new Date(order.data?.publication_date || '').toLocaleDateString()}
                                </p>
                            </div>

                            <div>
                                <h3 className="text-sm font-medium text-gray-400">Agencies</h3>
                                <p className="text-gray-200">
                                    {order.data?.agencies?.map(agency => agency.name).join(', ')}
                                </p>
                            </div>

                            {order.summary && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-400">Summary</h3>
                                    <p className="text-gray-200 whitespace-pre-wrap">{order.summary}</p>
                                </div>
                            )}

                            {!order.summary && (
                                <div className="flex justify-center pt-4">
                                    <Button
                                        onClick={handleSummarize}
                                        disabled={loading}
                                        className="w-full md:w-auto"
                                    >
                                        {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                                        Generate Summary
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-6 bg-[#1E293B] border-blue-900/30">
                    <h2 className="text-xl font-semibold text-gray-100 mb-4">Additional Information</h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-sm font-medium text-gray-400">Page Views</h3>
                            <p className="text-gray-200">
                                {order.content?.page_views?.count?.toLocaleString() || 'N/A'}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-400">Type</h3>
                            <p className="text-gray-200">{order.content?.type}</p>
                        </div>

                        <div>
                            <h3 className="text-sm font-medium text-gray-400">Signing Date</h3>
                            <p className="text-gray-200">
                                {order.content?.signing_date ?
                                    new Date(order.content.signing_date).toLocaleDateString() :
                                    'N/A'}
                            </p>
                        </div>

                        {order.content?.topics && order.content.topics.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-gray-400">Topics</h3>
                                <p className="text-gray-200">
                                    {order.content.topics.join(', ')}
                                </p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}
