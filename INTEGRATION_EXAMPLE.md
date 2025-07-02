// Example integration of AttributedReportViewer into existing ReportClient
// Replace the existing report body section with this enhanced version

// Add this import at the top of ReportClient.tsx
import { AttributedReportViewer } from '@/components/source-attribution';

// Replace the report body section (around line 170-180) with:
{report && (
    <div className={`transition-opacity duration-200 ${isTranslating ? 'opacity-50' : 'opacity-100'}`}>
        {/* Enhanced Interactive Report Body with Source Attribution */}
        <AttributedReportViewer
            reportId={report.reportId}
            reportBody={translatedContent?.body || report.body}
            sourceMessages={allMessages}
            className="prose prose-zinc max-w-none overflow-y-auto"
        />
    </div>
)}

// Alternative: For granular control, use InteractiveReportBody directly:
// import { InteractiveReportBody } from '@/components/source-attribution';
// 
// <InteractiveReportBody
//     reportBody={translatedContent?.body || report.body}
//     sourceMessages={allMessages}
//     className="prose prose-zinc max-w-none overflow-y-auto text-justify"
// />
