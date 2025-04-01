"use client"

import { Report } from "@/lib/types/core";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ReportDetailClient() {
    const params = useParams();
    const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;
    const channelId = Array.isArray(params.channelId) ? params.channelId[0] : params.channelId;

    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReportAndMessages = async () => {
            setIsLoading(true);
            const reportResponse = await fetch(`/api/report?channelId=${channelId}&reportId=${reportId}`);
            if (!reportResponse.ok) throw new Error('Failed to fetch reports');
            const data = await reportResponse.json();
            setReport(data.report);
            setIsLoading(false);
        }
        fetchReportAndMessages();
    }, [reportId, channelId]);

    return (
        <div>
            {isLoading ? (
                <div>Loading...</div>
            ) : (
                <div>
                    <h1>{report?.headline}</h1>
                    <p>{report?.body}</p>
                    <p>{report?.city}</p>
                </div>
            )}
        </div>
    )
}