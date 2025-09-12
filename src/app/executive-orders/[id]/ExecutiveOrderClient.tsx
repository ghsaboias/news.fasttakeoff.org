'use client';

import { Button } from "@/components/ui/button";
import ReactMarkdown from '@/components/ui/dynamic-markdown';
import { Loader } from "@/components/ui/loader";
import { findExecutiveOrderByNumber } from "@/lib/data/executive-orders";
import { ExecutiveOrder, Section } from "@/lib/types/executive-orders";
import { SummaryResponse } from "@/lib/types/external-apis";
import { parseDispositionNotes, type RelatedEOInfo } from "@/lib/utils";
import { ArrowLeft, ExternalLink, FileText, Info } from "lucide-react";
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
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(true);

    useEffect(() => {
        async function loadRelatedEOs() {
            if (!initialOrder?.metadata.dispositionNotes) return;

            const parsedRelatedEOs = parseDispositionNotes(initialOrder.metadata.dispositionNotes);
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

    useEffect(() => {
        async function fetchSummary() {
            if (!initialOrder) return;

            const cacheKey = `eo-summary-${initialOrder.id}`;
            const cachedSummary = localStorage.getItem(cacheKey);

            // If we have a cached summary, use it and set loading to false immediately
            if (cachedSummary) {
                setAiSummary(cachedSummary);
                setSummaryLoading(false);
                return;
            }

            // Only set summaryLoading to true if we don't have a cached summary
            setSummaryLoading(true);
            try {
                const response = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ order: initialOrder }),
                });

                if (!response.ok) {
                    throw new Error(`Failed to fetch summary: ${response.status}`);
                }

                const data = await response.json() as SummaryResponse;
                setAiSummary(data.summary);

                // Cache the summary in localStorage
                if (data.summary) {
                    localStorage.setItem(cacheKey, data.summary);
                }
            } catch (error) {
                console.error('Error fetching summary:', error);
            } finally {
                setSummaryLoading(false);
            }
        }

        fetchSummary();
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
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary-light text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                Executive Order {initialOrder.orderNumber}
                            </div>
                        )}
                        {initialOrder.publication.citation && (
                            <div className="inline-flex items-center gap-1 text-sm font-medium bg-primary-light text-primary px-2 py-1 rounded">
                                <Info className="h-4 w-4" />
                                {initialOrder.publication.citation}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-4">
                    {initialOrder.links.htmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.links.htmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <ExternalLink className="h-4 w-4" />
                                View on Federal Register
                            </a>
                        </Button>
                    )}
                    {initialOrder.links.pdfUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.links.pdfUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View PDF
                            </a>
                        </Button>
                    )}
                    {initialOrder.links.bodyHtmlUrl && (
                        <Button asChild variant="outline" size="sm">
                            <a href={initialOrder.links.bodyHtmlUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                View Full Text
                            </a>
                        </Button>
                    )}
                </div>

                {/* AI-Generated Summary Section */}
                <div className="bg-muted p-6 rounded-lg">
                    <h2 className="text-xl font-semibold mb-4">Executive Order Summary</h2>
                    {summaryLoading ? (
                        <div className="flex items-center justify-center p-6">
                            <Loader size="md" className="mr-2" />
                            <span>Generating summary...</span>
                        </div>
                    ) : aiSummary ? (
                        <div className="prose max-w-none dark:prose-invert">
                            <ReactMarkdown
                                components={{
                                    p: ({ ...props }) => {
                                        // Check if this paragraph contains only a strong element with a heading
                                        const children = props.children as React.ReactNode[];

                                        if (Array.isArray(children) && children.length > 0) {
                                            const firstChild = children[0];

                                            if (firstChild &&
                                                typeof firstChild === 'object' &&
                                                'type' in firstChild &&
                                                firstChild.type === 'strong' &&
                                                'props' in firstChild &&
                                                firstChild.props &&
                                                typeof firstChild.props === 'object') {

                                                const strongProps = firstChild.props as { children?: React.ReactNode };
                                                if (strongProps.children) {
                                                    const content = String(strongProps.children);
                                                    if (['Key Provisions', 'General Provisions'].includes(content)) {
                                                        return null;
                                                    }
                                                }
                                            }
                                        }

                                        return <p className="my-2" {...props} />;
                                    },
                                    strong: ({ ...props }) => {
                                        // Check if this is a standalone strong element that's likely a heading
                                        const content = props.children?.toString() || '';
                                        const isHeading = content && ['Background', 'Objective', 'Key Provisions', 'General Provisions'].includes(content);

                                        return isHeading ?
                                            <strong className="block mb-1 mt-3" {...props} /> :
                                            <strong {...props} />;
                                    },
                                    // Improve list rendering
                                    ul: ({ ...props }) => <ul className="list-disc pl-6 my-3" {...props} />,
                                    li: ({ ...props }) => <li className="mb-1" {...props} />
                                }}
                            >
                                {aiSummary}
                            </ReactMarkdown>
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Unable to generate summary at this time.</p>
                    )}
                </div>

                {relatedEOsFromNotes.length > 0 && (
                    <div className="bg-muted-light p-6 rounded-lg">
                        <div className="border-t border-border">
                            <h3 className="text-lg font-medium mb-2">Related Executive Orders</h3>
                            <ul className="space-y-2 flex-col">
                                {relatedEOsFromNotes.map((relatedEO, index) => (
                                    <li key={index} className="text-sm">
                                        <span className="font-medium">{relatedEO.relationship}:</span>{" "}
                                        {relatedEO.isLoading ? (
                                            <span className="inline-flex items-center gap-1 text-muted-foreground">
                                                <Loader size="sm" className="inline" />
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
                    </div>
                )}
                {/* {initialOrder.content ? (
                    <div>
                        <h2 className="text-xl font-semibold mb-4">Overview</h2>
                        <p className="text-muted-foreground whitespace-pre-line">{initialOrder.content.rawText}</p>
                    </div>
                ) : (
                    <div className="bg-muted-lighter p-6 rounded-lg text-center">
                        <h2 className="text-xl font-semibold mb-2">Full Text</h2>
                        <p className="text-muted-foreground">
                            The full text of this executive order is available through the links above.
                        </p>
                    </div>
                )} */}
                {initialOrder.content.sections && initialOrder.content.sections.length > 0 && initialOrder.content.sections.some(section => section.content) ? (
                    <div className="flex flex-col gap-6">
                        <h2 className="text-xl font-semibold">Key Sections</h2>
                        {initialOrder.content.sections.map((section: Section, index: number) => (
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
        </div >
    );
}