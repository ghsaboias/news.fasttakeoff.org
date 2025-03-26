"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Report } from "@/lib/types/core";

interface ReportAccordionProps {
    channelReport: {
        report: Report | null;
        loading: boolean;
        error: string | null
    } | undefined;
}

export default function ReportAccordion({ channelReport }: ReportAccordionProps) {
    if (channelReport?.error) {
        return (
            <div className="mt-4 p-4 bg-destructive-light text-destructive rounded-lg">
                {channelReport.error}
            </div>
        );
    }

    if (channelReport?.report) {
        return (
            <div>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="report">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer p-4 items-center bg-primary-foreground hover:bg-primary-light mb-4">
                            <div className="flex flex-col items-start gap-2 text-left">
                                <div className="font-bold">{channelReport.report.headline.toUpperCase()}</div>
                                <div className="text-xs text-muted-foreground">
                                    Generated: {new Date(channelReport.report.timestamp).toLocaleString()}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-4">
                                <div>
                                    <h3 className="font-semibold mb-2">Report</h3>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {channelReport.report.body}
                                    </p>
                                </div>
                                <Separator />
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>
        );
    }

    return null;
} 