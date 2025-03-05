'use client'

import { Search } from 'lucide-react'
import React, { ChangeEvent } from 'react'

interface Agency {
    name: string
}

interface OrderData {
    title: string
    type: string
    document_number: string
    html_url: string
    publication_date: string
    agencies: Agency[]
}

interface Order {
    data: OrderData
    content?: {
        page_views?: {
            count: number
        }
    }
}

type SortConfig = {
    key: keyof OrderData | 'views'
    direction: 'asc' | 'desc'
}

export default function Orders() {
    const [orders, setOrders] = React.useState<Order[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState<string | null>(null)
    const [searchTerm, setSearchTerm] = React.useState('')
    const [sortConfig, setSortConfig] = React.useState<SortConfig>({
        key: 'publication_date',
        direction: 'desc'
    })

    React.useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await fetch('/api/orders')
                if (!response.ok) {
                    throw new Error('Failed to fetch orders')
                }
                const data = await response.json()
                setOrders(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred')
            } finally {
                setLoading(false)
            }
        }

        fetchOrders()
    }, [])

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig((current: SortConfig) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }))
    }

    const sortedAndFilteredOrders = React.useMemo(() => {
        let result = [...orders]

        // Filter based on search term
        if (searchTerm) {
            const lowerSearchTerm = searchTerm.toLowerCase()
            result = result.filter(order =>
                order.data.title.toLowerCase().includes(lowerSearchTerm) ||
                order.data.document_number.toLowerCase().includes(lowerSearchTerm) ||
                order.data.agencies.some((agency: Agency) =>
                    agency.name.toLowerCase().includes(lowerSearchTerm)
                )
            )
        }

        // Sort
        result.sort((a: Order, b: Order) => {
            if (sortConfig.key === 'views') {
                const aViews = a.content?.page_views?.count || 0
                const bViews = b.content?.page_views?.count || 0
                return sortConfig.direction === 'asc' ? aViews - bViews : bViews - aViews
            }

            const aValue = a.data[sortConfig.key]
            const bValue = b.data[sortConfig.key]

            if (sortConfig.direction === 'asc') {
                return aValue > bValue ? 1 : -1
            }
            return aValue < bValue ? 1 : -1
        })

        return result
    }, [orders, searchTerm, sortConfig])

    if (loading) {
        return (
            <div className="container mx-auto py-10">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-200 rounded"></div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="container mx-auto py-10">
                <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-red-700">
                                {error}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        )
    }

    const getSortIcon = (key: SortConfig['key']) => {
        if (sortConfig.key !== key) return '↕'
        return sortConfig.direction === 'asc' ? '↑' : '↓'
    }

    return (
        <div className="container mx-auto py-10">
            <div className="mb-6">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search orders..."
                        value={searchTerm}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 pl-10 bg-[#1E293B] border border-blue-900/30 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-blue-900/30">
                <table className="min-w-full divide-y divide-blue-900/30">
                    <caption className="sr-only">Recent executive orders</caption>
                    <thead className="bg-[#1E293B]">
                        <tr>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-[#2E3B4E] transition-colors"
                                onClick={() => handleSort('title')}
                            >
                                Title {getSortIcon('title')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-[#2E3B4E] transition-colors"
                                onClick={() => handleSort('document_number')}
                            >
                                Document Number {getSortIcon('document_number')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-[#2E3B4E] transition-colors"
                                onClick={() => handleSort('publication_date')}
                            >
                                Publication Date {getSortIcon('publication_date')}
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                            >
                                Agency
                            </th>
                            <th
                                scope="col"
                                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-[#2E3B4E] transition-colors"
                                onClick={() => handleSort('views')}
                            >
                                Views {getSortIcon('views')}
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-[#1E293B] divide-y divide-blue-900/30">
                        {sortedAndFilteredOrders.map((order: Order) => (
                            <tr key={order.data.document_number} className="hover:bg-[#2E3B4E] transition-colors">
                                <td className="px-6 py-4">
                                    <a
                                        href={order.data.html_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        {order.data.title}
                                    </a>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">{order.data.document_number}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                    {new Date(order.data.publication_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-gray-300">
                                    {order.data.agencies.map((agency: Agency) => agency.name).join(', ')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                                    {order.content?.page_views?.count?.toLocaleString() || 'N/A'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {sortedAndFilteredOrders.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                    No orders found matching your search criteria.
                </div>
            )}
        </div>
    )
} 