'use client';

import { Button } from '@/components/ui/button';
import { LocalDateTimeFull } from '@/components/utils/LocalDateTime';
import { X } from 'lucide-react';
import Link from 'next/link';

interface ReportPanelProps {
    report: {
        reportId: string;
        headline: string;
        city: string;
        body: string;
        generatedAt: string;
        channelId?: string;
    };
    onClose: () => void;
}

export const ReportPanel: React.FC<ReportPanelProps> = ({ report, onClose }) => {
    const paragraphs = report.body.split('\n\n').filter(Boolean);

    return (
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l border-border h-full w-full p-4 overflow-y-auto overscroll-contain flex flex-col gap-4">
            <div className="flex justify-between items-start gap-3">
                <h2 className="text-xl font-semibold text-primary pr-2">{report.headline}</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="shrink-0 h-8 w-8 -mt-1 -mr-1 hover:bg-muted"
                >
                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    <span className="sr-only">Close</span>
                </Button>
            </div>

            <div className="flex flex-col gap-4">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>{report.city}</span>
                    <span className="mx-2">•</span>
                    <LocalDateTimeFull
                        dateString={report.generatedAt}
                        options={{ dateStyle: 'short', timeStyle: 'short' }}
                    />
                </div>

                <div className="leading-relaxed">
                    {paragraphs.map((paragraph, index) => (
                        <p key={index} className="mb-4 last:mb-0 text-justify text-foreground">
                            {paragraph}
                        </p>
                    ))}
                </div>

                <div className="pt-4">
                    <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                        <Button className="w-full">
                            View Full Report
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}; 