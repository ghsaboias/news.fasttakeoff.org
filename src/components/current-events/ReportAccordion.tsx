"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Report } from "@/lib/data/discord-reports";

interface ReportAccordionProps {
    reportData: {
        report: Report | null;
        loading: boolean;
        error: string | null
    } | undefined;
}

export default function ReportAccordion({ reportData }: ReportAccordionProps) {
    if (reportData?.error) {
        return (
            <div className="mt-4 p-4 bg-destructive/10 text-destructive rounded-lg">
                {reportData.error}
            </div>
        );
    }

    if (reportData?.report) {
        return (
            <div className="mt-4">
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="report">
                        <AccordionTrigger className="text-base font-semibold hover:no-underline cursor-pointer">
                            <div className="flex flex-col items-start gap-2 text-left">
                                <div className="font-bold">{reportData.report.headline}</div>
                                <div className="text-xs text-muted-foreground">
                                    Generated: {new Date(reportData.report.timestamp).toLocaleString()}
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <div className="space-y-4 pt-4">
                                <div>
                                    <h3 className="font-semibold mb-2">Report</h3>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                        {reportData.report.body}
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