'use client';

import { Button } from "@/components/ui/button";
import { findExecutiveOrderByNumber, type ExecutiveOrder } from "@/lib/data/executive-orders";
import { parseDispositionNotes, type RelatedEOInfo } from "@/lib/utils";
import { ArrowLeft, ExternalLink, FileText, Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface EnhancedRelatedEOInfo extends RelatedEOInfo {
    isLoading: boolean;
    fullId?: string | null;
}

export default function ExecutiveOrderClient({
    initialOrder,
}: {
    initialOrder: ExecutiveOrder;
}) {
    const router = useRouter();
    const [relatedEOsFromNotes, setRelatedEOsFromNotes] = useState<EnhancedRelatedEOInfo[]>([]);

    useEffect(() => {
        async function loadRelatedEOs() {
            if (!initialOrder?.dispositionNotes) return;

            const parsedRelatedEOs = parseDispositionNotes(initialOrder.dispositionNotes);
            const enhancedRelatedEOs = parsedRelatedEOs.map(eo => ({
                ...eo,
                isLoading: true,
                fullId: null,
            }));
            setRelatedEOsFromNotes(enhancedRelatedEOs);
            await prefetchRelatedEOIds(enhancedRelatedEOs);
        }

        loadRelatedEOs();
    }, [initialOrder]);

    const prefetchRelatedEOIds = async (relatedEOs: EnhancedRelatedEOInfo[]) => {
        try {
            const eosByDate: Record<string, EnhancedRelatedEOInfo[]> = {};
            relatedEOs.forEach(eo => {
                const dateKey = eo.date || 'unknown';
                if (!eosByDate[dateKey]) eosByDate[dateKey] = [];
                eosByDate[dateKey].push(eo);
            });

            for (const dateKey in eosByDate) {
                const eosInGroup = eosByDate[dateKey];
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

                setRelatedEOsFromNotes(prevEOs => {
                    const updatedEOs = [...prevEOs];
                    results.forEach(({ relatedEO, fullId }) => {
                        const index = prevEOs.findIndex(eo =>
                            eo.eoNumber === relatedEO.eoNumber && eo.relationship === relatedEO.relationship
                        );
                        if (index !== -1) {
                            updatedEOs[index] = { ...updatedEOs[index], isLoading: false, fullId };
                        }
                    });
                    return updatedEOs;
                });

                if (Object.keys(eosByDate).length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error("Error in prefetching related EO IDs:", error);
            setRelatedEOsFromNotes(prevEOs => prevEOs.map(eo => ({ ...eo, isLoading: false })));
        }
    };

    if (!initialOrder) {
        router.push('/404');
        return null;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex flex-col gap-8">
                <div>
                    <Button asChild variant="ghost" size="sm">
                        <Link href="/executive-orders" className="flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Executive Orders
                        </Link>
                    </Button>
                </div>
                <div>
                    <div className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium mb-2">
                        {initialOrder.category}
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                        {initialOrder.title}
                    </h1>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 items-center">
                        <p className="text-lg text-muted-foreground">Signed on {initialOrder.date}</p>
                        {initialOrder.orderNumber && (
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                Executive Order {initialOrder.orderNumber}
                            </div>
                        )}
                        {initialOrder.citation && (
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                {initialOrder.citation}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                    {initialOrder.htmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                View on Federal Register
                            </a>
                        </Button>
                    )}
                    {initialOrder.pdfUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View PDF
                            </a>
                        </Button>
                    )}
                    {initialOrder.bodyHtmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.bodyHtmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View Full Text
                            </a>
                        </Button>
                    )}
                </div>
                <div className="bg-muted/50 p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-2">Summary</h2>
                    <p className="text-muted-foreground">{initialOrder.summary}</p>
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
                {initialOrder.content ? (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Overview</h2>
                        <p className="text-muted-foreground whitespace-pre-line">{initialOrder.content}</p>
                    </div>
                ) : (
                    <div className="bg-muted/30 p-6 rounded-lg text-center">
                        <h2 className="text-xl font-semibold mb-2">Full Text</h2>
                        <p className="text-muted-foreground">
                            The full text of this executive order is available through the links above.
                        </p>
                    </div>
                )}
                {initialOrder.sections && initialOrder.sections.length > 0 && initialOrder.sections.some(section => section.content) ? (
                    <div className="flex flex-col gap-6">
                        <h2 className="text-xl font-semibold">Key Sections</h2>
                        {initialOrder.sections.map((section, index) => (
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