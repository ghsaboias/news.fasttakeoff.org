import { useCallback, useEffect, useRef, useState } from 'react';

interface UseApiOptions<T> {
    initialData?: T;
    manual?: boolean;
    onSuccess?: (data: T) => void;
    onError?: (error: Error) => void;
    // Add polling option
    pollInterval?: number;
}

interface UseApiState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    request: (...args: unknown[]) => Promise<T | undefined>;
}

export function useApi<T = unknown>(
    fetcher: (...args: unknown[]) => Promise<T>,
    options: UseApiOptions<T> = {}
): UseApiState<T> {
    const { initialData, manual = false, onSuccess, onError, pollInterval } = options;

    const [data, setData] = useState<T | null>(initialData || null);
    const [loading, setLoading] = useState<boolean>(!manual);
    const [error, setError] = useState<Error | null>(null);

    // Use refs for callback functions to avoid unnecessary re-renders
    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const fetcherRef = useRef(fetcher);

    // Update refs when callbacks change
    useEffect(() => {
        onSuccessRef.current = onSuccess;
        onErrorRef.current = onError;
        fetcherRef.current = fetcher;
    }, [onSuccess, onError, fetcher]);

    const request = useCallback(async (...args: unknown[]): Promise<T | undefined> => {
        setLoading(true);
        setError(null);
        try {
            const result = await fetcherRef.current(...args);
            setData(result);
            if (onSuccessRef.current) {
                onSuccessRef.current(result);
            }
            return result;
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error('An unknown error occurred');
            setError(error);
            if (onErrorRef.current) {
                onErrorRef.current(error);
            }
            return undefined;
        } finally {
            setLoading(false);
        }
    }, []); // No dependencies needed since we use refs

    useEffect(() => {
        let mounted = true;
        let intervalId: NodeJS.Timeout | undefined;

        const executeRequest = async () => {
            if (mounted) {
                await request();
            }
        };

        if (!manual) {
            executeRequest();
        }

        if (pollInterval && !manual) {
            intervalId = setInterval(executeRequest, pollInterval);
        }

        return () => {
            mounted = false;
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [manual, pollInterval, request]);

    return { data, loading, error, request };
} 