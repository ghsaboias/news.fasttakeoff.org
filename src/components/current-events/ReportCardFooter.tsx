'use client';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ReportCardFooterProps {
    readMoreHref?: string;
    timeframeText?: string;
    itemCount?: number;
    itemUnitSingular?: string; // e.g., "source", "update"
    itemCountIsLink?: boolean;
    itemCountLinkHref?: string; // Only used if itemCountIsLink is true
}

export default function ReportCardFooter({
    readMoreHref,
    timeframeText,
    itemCount,
    itemUnitSingular,
    itemCountIsLink = false,
    itemCountLinkHref,
}: ReportCardFooterProps) {
    const itemUnitText = itemCount === 1 ? itemUnitSingular : itemUnitSingular ? `${itemUnitSingular}s` : '';

    const showFooterContentRow = timeframeText || (itemCount !== undefined && itemUnitSingular);

    // If no content at all, render nothing to avoid empty footer styling issues
    if (!readMoreHref && !showFooterContentRow) {
        return null;
    }

    return (
        <>
            {readMoreHref && (
                <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href={readMoreHref}>
                        Read More
                    </Link>
                </Button>
            )}
            {showFooterContentRow && (
                <div className="flex flex-row gap-1 justify-between w-full items-center">
                    {timeframeText ? (
                        <Badge variant="secondary" className="px-1 py-0 h-5">
                            {timeframeText}
                        </Badge>
                    ) : (
                        // Placeholder to maintain structure for justify-between if item count is shown
                        (itemCount !== undefined && itemUnitSingular) ? <div /> : null
                    )}

                    {(itemCount !== undefined && itemUnitSingular) && (
                        itemCountIsLink && itemCountLinkHref ? (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={itemCountLinkHref}>
                                    <span className="font-medium">{itemCount}</span> {itemUnitText}
                                </Link>
                            </Button>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                <span className="font-medium">{itemCount}</span> {itemUnitText}
                            </div>
                        )
                    )}
                    {/* Placeholder if timeframe is shown but item count is not, to balance justify-between */}
                    {timeframeText && !(itemCount !== undefined && itemUnitSingular) && <div />}
                </div>
            )}
        </>
    );
} 