import { useCallback, useEffect, useState } from 'react';

interface FinancialData {
  symbol: string;
  price?: number;
  currency?: string;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  scrapedAt?: string;
}

interface UseLiveFinancialDataOptions {
  refreshInterval?: number; // in milliseconds, default 5 minutes
  enabled?: boolean;
}

interface UseLiveFinancialDataReturn {
  financialData: Record<string, FinancialData>;
  loading: boolean;
  error: string | null;
  getEntityPrice: (ticker?: string) => number | undefined;
  getEntityChangePercent: (ticker?: string) => number | undefined;
  isLiveData: (ticker?: string) => boolean;
  refetch: () => Promise<void>;
}

export function useLiveFinancialData(
  options: UseLiveFinancialDataOptions = {}
): UseLiveFinancialDataReturn {
  const { refreshInterval = 5 * 60 * 1000, enabled = true } = options; // 5 minutes default

  const [financialData, setFinancialData] = useState<Record<string, FinancialData>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFinancialData = useCallback(async () => {
    if (!enabled) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/power-network/financial-data');
      if (!response.ok) {
        throw new Error(`Failed to fetch financial data: ${response.status}`);
      }

      const data: FinancialData[] = await response.json();

      // Convert array to object keyed by symbol for easy lookup
      const dataBySymbol = data.reduce<Record<string, FinancialData>>((acc, item) => {
        if (item.symbol) {
          acc[item.symbol.toUpperCase()] = item;
        }
        return acc;
      }, {});

      setFinancialData(dataBySymbol);

    } catch (err) {
      console.error('[useLiveFinancialData] Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch financial data');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  // Initial fetch
  useEffect(() => {
    if (enabled) {
      fetchFinancialData();
    }
  }, [fetchFinancialData, enabled]);

  // Set up refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;

    const interval = setInterval(fetchFinancialData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchFinancialData, refreshInterval, enabled]);

  // Helper function to get price for an entity
  const getEntityPrice = useCallback((ticker?: string): number | undefined => {
    if (!ticker) return undefined;
    return financialData[ticker.toUpperCase()]?.price;
  }, [financialData]);

  // Helper function to calculate day change percentage
  const getEntityChangePercent = useCallback((ticker?: string): number | undefined => {
    if (!ticker) return undefined;

    const data = financialData[ticker.toUpperCase()];
    if (!data?.price || !data?.previousClose) return undefined;

    return ((data.price - data.previousClose) / data.previousClose) * 100;
  }, [financialData]);

  // Helper function to check if we have live data for an entity
  const isLiveData = useCallback((ticker?: string): boolean => {
    if (!ticker) return false;
    return !!financialData[ticker.toUpperCase()];
  }, [financialData]);

  return {
    financialData,
    loading,
    error,
    getEntityPrice,
    getEntityChangePercent,
    isLiveData,
    refetch: fetchFinancialData,
  };
}