'use client'

import { Button } from "@/components/ui/button"
import { fetchExecutiveOrderById, findExecutiveOrderByNumber, type ExecutiveOrder } from "@/lib/data/executive-orders"
import { parseDispositionNotes, type RelatedEOInfo } from "@/lib/utils"
import { ArrowLeft, ExternalLink, FileText, Info, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { use, useEffect, useState } from "react"

interface Params {
    id: string;
}

// Extended interface to track loading state and ID for each related EO
interface EnhancedRelatedEOInfo extends RelatedEOInfo {
    isLoading: boolean;
    fullId?: string | null;
}

export default function ExecutiveOrderPage({ params }: { params: Params }) {
    // Unwrap params using React.use()
    const unwrappedParams = use(params as unknown as Promise<Params>);
    const { id } = unwrappedParams;

    const router = useRouter();
    const [executiveOrder, setExecutiveOrder] = useState<ExecutiveOrder | null>(null);
    const [relatedEOsFromNotes, setRelatedEOsFromNotes] = useState<EnhancedRelatedEOInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadExecutiveOrder() {
            try {
                // Find the executive order with the matching ID
                const order = await fetchExecutiveOrderById(id);

                // If no matching executive order is found, redirect to 404
                if (!order) {
                    router.push('/404');
                    return;
                }

                setExecutiveOrder(order);

                // Parse disposition notes for related EOs
                if (order.dispositionNotes) {
                    const parsedRelatedEOs = parseDispositionNotes(order.dispositionNotes);
                    // Initialize enhanced related EOs with loading state
                    const enhancedRelatedEOs = parsedRelatedEOs.map(eo => ({
                        ...eo,
                        isLoading: true,
                        fullId: null
                    }));
                    setRelatedEOsFromNotes(enhancedRelatedEOs);

                    // Prefetch IDs for all related EOs
                    prefetchRelatedEOIds(enhancedRelatedEOs);
                }
            } catch (error) {
                console.error("Error fetching executive order:", error);
                router.push('/404');
            } finally {
                setLoading(false);
            }
        }

        loadExecutiveOrder();
    }, [id, router]);

    // Function to prefetch IDs for all related EOs
    const prefetchRelatedEOIds = async (relatedEOs: EnhancedRelatedEOInfo[]) => {
        try {
            // Group related EOs by date to batch requests with similar dates
            const eosByDate: Record<string, EnhancedRelatedEOInfo[]> = {};

            relatedEOs.forEach(eo => {
                const dateKey = eo.date || 'unknown';
                if (!eosByDate[dateKey]) {
                    eosByDate[dateKey] = [];
                }
                eosByDate[dateKey].push(eo);
            });

            // Process each date group sequentially to leverage caching
            for (const dateKey in eosByDate) {
                const eosInGroup = eosByDate[dateKey];

                // Process EOs in this date group
                const results = await Promise.all(
                    eosInGroup.map(async (relatedEO) => {
                        try {
                            const fullId = await findExecutiveOrderByNumber(relatedEO.eoNumber, relatedEO.date);
                            return { relatedEO, fullId };
                        } catch (error) {
                            console.error(`Error prefetching ID for EO ${relatedEO.eoNumber}:`, error);
                            return { relatedEO, fullId: null };
                        }
                    })
                );

                // Update state with all results from this batch
                setRelatedEOsFromNotes(prevEOs => {
                    const updatedEOs = [...prevEOs];

                    results.forEach(({ relatedEO, fullId }) => {
                        const index = prevEOs.findIndex(eo =>
                            eo.eoNumber === relatedEO.eoNumber &&
                            eo.relationship === relatedEO.relationship
                        );

                        if (index !== -1) {
                            updatedEOs[index] = {
                                ...updatedEOs[index],
                                isLoading: false,
                                fullId: fullId
                            };
                        }
                    });

                    return updatedEOs;
                });

                // Small delay between date groups to avoid overwhelming the API
                if (Object.keys(eosByDate).length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error("Error in prefetching related EO IDs:", error);

            // Mark all as not loading in case of error
            setRelatedEOsFromNotes(prevEOs =>
                prevEOs.map(eo => ({
                    ...eo,
                    isLoading: false
                }))
            );
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col items-center justify-center py-12">
                    <p className="text-lg font-medium">Loading executive order...</p>
                </div>
            </div>
        );
    }

    if (!executiveOrder) {
        return null; // This shouldn't happen as we redirect on null, but TypeScript needs it
    }

    console.log(executiveOrder);

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col gap-8">
                {/* Back button */}
                <div>
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/executive-orders" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Executive Orders
                        </Link>
                    </Button>
                </div>

                {/* Header */}
                <div>
                    <div className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium mb-2">
                        {executiveOrder.category}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                        {executiveOrder.title}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 items-center">
                        <p className="text-lg text-muted-foreground">
                            Signed on {executiveOrder.date}
                        </p>
                        {executiveOrder.orderNumber && (
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                Executive Order {executiveOrder.orderNumber}
                            </div>
                        )}
                        {executiveOrder.citation && (
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                {executiveOrder.citation}
                            </div>
                        )}
                    </div>
                </div>

                {/* Official Links */}
                <div className="flex flex-wrap gap-4">
                    {executiveOrder.htmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={executiveOrder.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                View on Federal Register
                            </a>
                        </Button>
                    )}
                    {executiveOrder.pdfUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={executiveOrder.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View PDF
                            </a>
                        </Button>
                    )}
                    {executiveOrder.bodyHtmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={executiveOrder.bodyHtmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View Full Text
                            </a>
                        </Button>
                    )}
                </div>

                {/* Summary */}
                <div className="bg-muted/50 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">Summary</h2>
                    <p className="text-muted-foreground">{executiveOrder.summary}</p>

                    {/* Related EOs from Disposition Notes */}
                    {relatedEOsFromNotes.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium mb-2">Related Executive Orders</h3>
                            <ul className="space-y-2 flex-col">
                                {relatedEOsFromNotes.map((relatedEO, index) => (
                                    <li key={index} className="text-sm">
                                        <span className="font-medium">{relatedEO.relationship}:</span>{" "}
                                        {relatedEO.isLoading ? (
                                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                <Loader2 className="h-2 w-2 animate-spin inline" />
                                                <span>EO {relatedEO.eoNumber}</span>
                                            </span>
                                        ) : (
                                            <Link
                                                href={relatedEO.fullId ? `/executive-orders/${relatedEO.fullId}` : `/executive-orders/${relatedEO.eoNumber}`}
                                                className="text-primary hover:underline"
                                            >
                                                EO {relatedEO.eoNumber}
                                            </Link>
                                        )}
                                        {relatedEO.date && <span className="text-muted-foreground ml-1">({relatedEO.date})</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Content */}
                {executiveOrder.content ? (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Overview</h2>
                        <p className="text-muted-foreground whitespace-pre-line">{executiveOrder.content}</p>
                    </div>
                ) : (
                    <div className="bg-muted/30 p-6 rounded-lg text-center">
                        <h2 className="text-xl font-semibold mb-2">Full Text</h2>
                        <p className="text-muted-foreground">
                            The full text of this executive order is available through the links above.
                        </p>
                    </div>
                )}

                {/* Sections */}
                {executiveOrder.sections && executiveOrder.sections.length > 0 && executiveOrder.sections.some(section => section.content) ? (
                    <div className="flex flex-col gap-6">
                        <h2 className="text-xl font-semibold">Key Sections</h2>
                        {executiveOrder.sections.map((section, index) => (
                            section.content ? (
                                <div key={index} className="border rounded-lg p-6">
                                    <h3 className="text-lg font-medium mb-2">{section.title}</h3>
                                    <p className="text-muted-foreground">{section.content}</p>
                                </div>
                            ) : null
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
} 