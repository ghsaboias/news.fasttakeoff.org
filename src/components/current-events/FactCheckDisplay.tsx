"use client"

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { useApi } from "@/lib/hooks";
import { FactCheckResult } from "@/lib/types/core";
import { AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { useMemo } from "react";
import LinkPreview from "./LinkPreview";

interface FactCheckDisplayProps {
    reportId: string;
    className?: string;
}

const getVerificationIcon = (verification: string) => {
    switch (verification) {
        case 'verified':
            return <CheckCircle className="h-4 w-4 text-green-600" />;
        case 'partially-verified':
            return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
        case 'unverified':
            return <Info className="h-4 w-4 text-blue-600" />;
        case 'false':
            return <XCircle className="h-4 w-4 text-red-600" />;
        default:
            return <Info className="h-4 w-4 text-gray-600" />;
    }
};

const getVerificationColor = (verification: string) => {
    switch (verification) {
        case 'verified':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'partially-verified':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'unverified':
            return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'false':
            return 'bg-red-100 text-red-800 border-red-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

const getCredibilityColor = (credibility: string) => {
    switch (credibility) {
        case 'high':
            return 'bg-green-100 text-green-800 border-green-200';
        case 'medium':
            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        case 'low':
            return 'bg-red-100 text-red-800 border-red-200';
        default:
            return 'bg-gray-100 text-gray-800 border-gray-200';
    }
};

export default function FactCheckDisplay({ reportId, className }: FactCheckDisplayProps) {
    const { data: factCheck, loading, error } = useApi<FactCheckResult>(
        () => fetch(`/api/fact-check?reportId=${reportId}`).then(res => res.json()),
        { manual: false }
    );

    const hasValidFactCheck = useMemo(() => {
        return factCheck && factCheck.claims && factCheck.claims.length > 0;
    }, [factCheck]);

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Fact Check
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-4">
                        <Loader size="sm" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading fact-check results...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error || !factCheck) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Fact Check
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Fact-check results are not available for this report.
                    </p>
                </CardContent>
            </Card>
        );
    }

    if (!hasValidFactCheck) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Fact Check
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        {factCheck.verificationSummary || 'Fact-check not yet available for this report'}
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Fact Check
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                    <span>Overall Credibility:</span>
                    <Badge className={getCredibilityColor(factCheck.overallCredibility)}>
                        {factCheck.overallCredibility.toUpperCase()}
                    </Badge>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {factCheck.verificationSummary && (
                    <div className="p-3 rounded-lg">
                        <p className="text-sm">{factCheck.verificationSummary}</p>
                    </div>
                )}

                {factCheck.claims.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="font-medium">Verified Claims</h4>
                        {factCheck.claims
                            .sort((a, b) => b.importance - a.importance)
                            .map((claim, index) => (
                                <div key={index} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-start gap-2">
                                        {getVerificationIcon(claim.verification)}
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">{claim.claim}</p>
                                            <Badge className={`mt-1 ${getVerificationColor(claim.verification)}`}>
                                                {claim.verification.replace('-', ' ')}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Importance: {claim.importance}/10
                                        </div>
                                    </div>
                                    {claim.details && (
                                        <p className="text-xs text-muted-foreground ml-6">
                                            {claim.details}
                                        </p>
                                    )}
                                    {claim.sources.length > 0 && (
                                        <div className="ml-6 space-y-2">
                                            <div className="text-xs font-medium text-muted-foreground">
                                                Sources:
                                            </div>
                                            {claim.sources.slice(0, 3).map((source, sourceIndex) => (
                                                <LinkPreview
                                                    key={sourceIndex}
                                                    url={source}
                                                    className="w-full"
                                                />
                                            ))}
                                            {claim.sources.length > 3 && (
                                                <div className="space-y-2">
                                                    {claim.sources.slice(3).map((source, sourceIndex) => (
                                                        <LinkPreview
                                                            key={sourceIndex + 3}
                                                            url={source}
                                                            className="w-full"
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>
                )}

                {factCheck.improvements.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-medium">Suggested Improvements</h4>
                        <ul className="text-sm space-y-1">
                            {factCheck.improvements.map((improvement, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-muted-foreground">•</span>
                                    <span>{improvement}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {factCheck.missingContext.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="font-medium">Missing Context</h4>
                        <ul className="text-sm space-y-1">
                            {factCheck.missingContext.map((context, index) => (
                                <li key={index} className="flex items-start gap-2">
                                    <span className="text-muted-foreground">•</span>
                                    <span>{context}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="text-xs text-muted-foreground pt-2 border-t">
                    Fact-checked on {new Date(factCheck.checkedAt).toLocaleString()}
                </div>
            </CardContent>
        </Card>
    );
} 