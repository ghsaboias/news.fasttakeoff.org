import { useEffect, useState } from 'react';

interface UseGeolocationOptions {
    /** Initial value before geo data is loaded. Defaults to null for loading state */
    initialValue?: boolean | null;
    /** Whether to assume non-US on error. Defaults to false */
    assumeNonUSOnError?: boolean;
}

/**
 * Hook to determine if the user is US-based via geolocation API
 * Consolidates duplicate geo-checking logic across components
 */
export function useGeolocation(options: UseGeolocationOptions = {}) {
    const { initialValue = null, assumeNonUSOnError = false } = options;
    const [isUSBased, setIsUSBased] = useState<boolean | null>(initialValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function checkGeolocation() {
            try {
                setLoading(true);
                setError(null);

                const response = await fetch('/api/geo');
                if (!response.ok) {
                    throw new Error(`Geo API error: ${response.status}`);
                }

                const data = await response.json();
                // Treat 'XX' (unknown/local) as potentially US for local dev convenience
                setIsUSBased(data.country === 'US');
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch geolocation';
                console.error('Error checking geolocation:', errorMessage);
                setError(errorMessage);
                setIsUSBased(assumeNonUSOnError ? false : null);
            } finally {
                setLoading(false);
            }
        }

        checkGeolocation();
    }, [assumeNonUSOnError]);

    return { isUSBased, loading, error };
}