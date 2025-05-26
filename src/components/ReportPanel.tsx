import { Button } from '@/components/ui/button';
import { formatTime } from '@/lib/utils';
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
    return (
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l border-border h-full w-full p-6 overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-primary">{report.headline}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="mt-[-8px] mr-[-8px]">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>{report.city}</span>
                    <span className="mx-2">•</span>
                    <span>{formatTime(report.generatedAt, true)}</span>
                </div>

                <p className="text-foreground/90 leading-relaxed">
                    {report.body}
                </p>

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