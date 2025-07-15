import { useCallback } from 'react';
import type { ExecutiveSummary } from '../types/core';
import { useApi } from './useApi';

interface UseExecutiveSummaryOptions {
    manual?: boolean;
    onSuccess?: (data: ExecutiveSummary) => void;
    onError?: (error: Error) => void;
    pollInterval?: number;
}

interface UseExecutiveSummaryState {
    summary: ExecutiveSummary | null;
    loading: boolean;
    error: Error | null;
    refetch: () => Promise<ExecutiveSummary | undefined>;
}

export function useExecutiveSummary(
    options: UseExecutiveSummaryOptions = {}
): UseExecutiveSummaryState {
    const fetchExecutiveSummary = useCallback(async (): Promise<ExecutiveSummary> => {
        const response = await fetch('/api/executive-summary');

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('No executive summary available yet. Check back later.');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return response.json();
    }, []);

    const { data: summary, loading, error, request: refetch } = useApi<ExecutiveSummary>(
        fetchExecutiveSummary,
        options
    );

    return {
        summary,
        loading,
        error,
        refetch
    };
} 