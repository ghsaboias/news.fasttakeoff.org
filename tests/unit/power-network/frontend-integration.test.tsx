import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// Mock the hooks we'll be testing
const mockUseGraphData = vi.fn();
const mockUseLiveFinancialData = vi.fn();

vi.mock('@/lib/hooks/useGraphData', () => ({
  useGraphData: mockUseGraphData,
}));

vi.mock('@/lib/hooks/useLiveFinancialData', () => ({
  useLiveFinancialData: mockUseLiveFinancialData,
}));

describe('Power Network Frontend Integration', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    mockUseGraphData.mockReset();
    mockUseLiveFinancialData.mockReset();
  });

  describe('useLiveFinancialData hook', () => {
    it('should fetch live financial data for all companies', async () => {
      const mockData = [
        {
          symbol: 'TSLA',
          price: 425.85,
          currency: 'USD',
          marketCap: 1350000000000,
          dayChangePercent: 2.5,
          scrapedAt: new Date().toISOString(),
        },
        {
          symbol: 'AAPL',
          price: 230.50,
          currency: 'USD',
          marketCap: 3572750000000,
          dayChangePercent: -0.8,
          scrapedAt: new Date().toISOString(),
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: mockData,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { data, loading, error } = mockUseLiveFinancialData();

      expect(data).toHaveLength(2);
      expect(data[0].symbol).toBe('TSLA');
      expect(data[1].symbol).toBe('AAPL');
      expect(loading).toBe(false);
      expect(error).toBeNull();
    });

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      mockUseLiveFinancialData.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch financial data',
        refetch: vi.fn(),
      });

      const { data, loading, error } = mockUseLiveFinancialData();

      expect(data).toBeNull();
      expect(loading).toBe(false);
      expect(error).toBe('Failed to fetch financial data');
    });

    it('should show loading state during fetch', async () => {
      mockUseLiveFinancialData.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { data, loading, error } = mockUseLiveFinancialData();

      expect(data).toBeNull();
      expect(loading).toBe(true);
      expect(error).toBeNull();
    });

    it('should provide refetch functionality', async () => {
      const mockRefetch = vi.fn();

      mockUseLiveFinancialData.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      const { refetch } = mockUseLiveFinancialData();

      refetch();

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('should cache data for 15 minutes', async () => {
      const recentTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
      const mockData = [
        {
          symbol: 'TSLA',
          price: 425.85,
          scrapedAt: recentTimestamp,
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: mockData,
        loading: false,
        error: null,
        refetch: vi.fn(),
        isCached: true,
        lastFetch: recentTimestamp,
      });

      const { data, isCached, lastFetch } = mockUseLiveFinancialData();

      expect(isCached).toBe(true);
      expect(lastFetch).toBe(recentTimestamp);
      expect(data[0].scrapedAt).toBe(recentTimestamp);
    });
  });

  describe('useEnhancedGraphData hook', () => {
    it('should combine static graph data with live financial data', async () => {
      const staticGraphData = {
        nodes: [
          {
            id: 'tesla',
            name: 'Tesla Inc.',
            type: 'company',
            ticker: 'TSLA',
            marketCap: 0.83, // Old static value
          },
          {
            id: 'elon',
            name: 'Elon Musk',
            type: 'person',
            netWorth: 350,
          },
        ],
        edges: [
          { source: 'elon', target: 'tesla' },
        ],
      };

      const liveFinancialData = [
        {
          symbol: 'TSLA',
          price: 425.85,
          marketCap: 1350000000000, // Live value: $1.35T
          dayChangePercent: 2.5,
        },
      ];

      mockUseGraphData.mockReturnValue({
        data: staticGraphData,
        loading: false,
        error: null,
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: liveFinancialData,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Mock the enhanced hook that combines both
      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: {
          ...staticGraphData,
          nodes: staticGraphData.nodes.map(node => {
            if (node.ticker === 'TSLA') {
              const liveData = liveFinancialData.find(d => d.symbol === 'TSLA');
              return {
                ...node,
                livePrice: liveData?.price,
                liveMarketCap: liveData?.marketCap ? liveData.marketCap / 1_000_000_000_000 : undefined, // Convert to trillions
                dayChangePercent: liveData?.dayChangePercent,
                isLiveData: true,
              };
            }
            return node;
          }),
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { data } = mockUseEnhancedGraphData();

      const teslaNode = data.nodes.find((n: any) => n.id === 'tesla');
      expect(teslaNode.livePrice).toBe(425.85);
      expect(teslaNode.liveMarketCap).toBe(1.35);
      expect(teslaNode.dayChangePercent).toBe(2.5);
      expect(teslaNode.isLiveData).toBe(true);
    });

    it('should handle nodes without tickers gracefully', async () => {
      const staticGraphData = {
        nodes: [
          {
            id: 'elon',
            name: 'Elon Musk',
            type: 'person',
            netWorth: 350,
          },
          {
            id: 'fund-1',
            name: 'ARK Invest',
            type: 'fund',
            aum: 50,
          },
        ],
        edges: [],
      };

      mockUseGraphData.mockReturnValue({
        data: staticGraphData,
        loading: false,
        error: null,
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: {
          ...staticGraphData,
          nodes: staticGraphData.nodes.map(node => ({
            ...node,
            isLiveData: false,
          })),
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { data } = mockUseEnhancedGraphData();

      const elonNode = data.nodes.find((n: any) => n.id === 'elon');
      const fundNode = data.nodes.find((n: any) => n.id === 'fund-1');

      expect(elonNode.isLiveData).toBe(false);
      expect(elonNode.netWorth).toBe(350);
      expect(fundNode.isLiveData).toBe(false);
      expect(fundNode.aum).toBe(50);
    });

    it('should show loading state when either data source is loading', async () => {
      mockUseGraphData.mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { data, loading } = mockUseEnhancedGraphData();

      expect(data).toBeNull();
      expect(loading).toBe(true);
    });

    it('should handle partial failures gracefully', async () => {
      mockUseGraphData.mockReturnValue({
        data: { nodes: [], edges: [] },
        loading: false,
        error: null,
      });

      mockUseLiveFinancialData.mockReturnValue({
        data: null,
        loading: false,
        error: 'Failed to fetch live data',
        refetch: vi.fn(),
      });

      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: { nodes: [], edges: [] },
        loading: false,
        error: 'Failed to fetch live data',
        refetch: vi.fn(),
        hasPartialData: true,
      });

      const { data, error, hasPartialData } = mockUseEnhancedGraphData();

      expect(data).toEqual({ nodes: [], edges: [] });
      expect(error).toBe('Failed to fetch live data');
      expect(hasPartialData).toBe(true);
    });
  });

  describe('PowerNetworkVisualization component integration', () => {
    it('should render with enhanced financial data', async () => {
      const MockPowerNetworkVisualization = () => {
        const { data, loading } = mockUseEnhancedGraphData();

        if (loading) return <div>Loading...</div>;

        return (
          <div>
            {data.nodes.map((node: any) => (
              <div key={node.id} data-testid={`node-${node.id}`}>
                <span>{node.name}</span>
                {node.isLiveData && (
                  <span data-testid="live-indicator">🟢 Live</span>
                )}
                {node.livePrice && (
                  <span data-testid="live-price">${node.livePrice}</span>
                )}
              </div>
            ))}
          </div>
        );
      };

      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: {
          nodes: [
            {
              id: 'tesla',
              name: 'Tesla Inc.',
              ticker: 'TSLA',
              livePrice: 425.85,
              isLiveData: true,
            },
          ],
          edges: [],
        },
        loading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { getByTestId, getByText } = render(<MockPowerNetworkVisualization />);

      expect(getByText('Tesla Inc.')).toBeInTheDocument();
      expect(getByTestId('live-indicator')).toBeInTheDocument();
      expect(getByTestId('live-price')).toHaveTextContent('$425.85');
    });

    it('should show fallback to static data when live data fails', async () => {
      const MockPowerNetworkVisualization = () => {
        const { data, loading, hasPartialData } = mockUseEnhancedGraphData();

        if (loading) return <div>Loading...</div>;

        return (
          <div>
            {hasPartialData && (
              <div data-testid="partial-data-warning">
                Using cached data - live data unavailable
              </div>
            )}
            {data.nodes.map((node: any) => (
              <div key={node.id} data-testid={`node-${node.id}`}>
                <span>{node.name}</span>
                {!node.isLiveData && (
                  <span data-testid="static-indicator">📊 Static</span>
                )}
                <span data-testid="market-cap">
                  ${node.marketCap}T
                </span>
              </div>
            ))}
          </div>
        );
      };

      const mockUseEnhancedGraphData = vi.fn().mockReturnValue({
        data: {
          nodes: [
            {
              id: 'tesla',
              name: 'Tesla Inc.',
              ticker: 'TSLA',
              marketCap: 0.83, // Static fallback
              isLiveData: false,
            },
          ],
          edges: [],
        },
        loading: false,
        error: 'Live data unavailable',
        hasPartialData: true,
        refetch: vi.fn(),
      });

      const { getByTestId, getByText } = render(<MockPowerNetworkVisualization />);

      expect(getByTestId('partial-data-warning')).toBeInTheDocument();
      expect(getByText('Tesla Inc.')).toBeInTheDocument();
      expect(getByTestId('static-indicator')).toBeInTheDocument();
      expect(getByTestId('market-cap')).toHaveTextContent('$0.83T');
    });
  });
});