import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { PowerNetworkFinancialService } from '@/lib/services/power-network-financial-service';

describe('PowerNetworkFinancialService', () => {
  let mockD1: D1Database;
  let service: PowerNetworkFinancialService;

  beforeEach(() => {
    mockD1 = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      first: vi.fn(),
      run: vi.fn(),
    } as any;
  });

  describe('fetchLiveFinancialData', () => {
    it('should fetch live financial data from D1 for a single symbol', async () => {
      const mockDbData = {
        symbol: 'TSLA',
        price: 425.85,
        currency: 'USD',
        exchange: undefined,
        volume: 150000000,
        day_high: 430.00,
        day_low: 420.00,
        fifty_two_week_high: 500.00,
        fifty_two_week_low: 300.00,
        market_cap: 1350000000000,
        previous_close: 420.00,
        scraped_at: '2025-09-24T10:00:00Z',
      };

      const expectedResult = {
        symbol: 'TSLA',
        price: 425.85,
        currency: 'USD',
        exchange: undefined,
        volume: 150000000,
        dayHigh: 430.00,
        dayLow: 420.00,
        fiftyTwoWeekHigh: 500.00,
        fiftyTwoWeekLow: 300.00,
        marketCap: 1350000000000,
        previousClose: 420.00,
        scrapedAt: '2025-09-24T10:00:00Z',
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockDbData),
        }),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.fetchLiveFinancialData('TSLA');

      expect(result).toEqual(expectedResult);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM power_network_financials')
      );
    });

    it('should fetch multiple companies financial data', async () => {
      const mockData = {
        results: [
          { symbol: 'TSLA', price: 425.85 },
          { symbol: 'AAPL', price: 230.50 },
          { symbol: 'GOOGL', price: 180.25 },
        ],
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue(mockData),
        }),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.fetchMultipleFinancialData(['TSLA', 'AAPL', 'GOOGL']);

      expect(result).toHaveLength(3);
      expect(result[0].symbol).toBe('TSLA');
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE symbol IN (?,?,?)')
      );
    });

    it('should calculate market cap from price and shares outstanding', async () => {
      const service = new PowerNetworkFinancialService(mockD1);
      const marketCap = service.calculateMarketCap(230.50, 15_500_000_000); // AAPL example

      expect(marketCap).toBeCloseTo(3572750000000, 2); // ~$3.57T
    });

    it('should return cached data if fresh enough (< 15 minutes old)', async () => {
      const recentTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 mins ago
      const mockData = {
        symbol: 'TSLA',
        price: 425.85,
        currency: undefined,
        exchange: undefined,
        market_cap: undefined,
        volume: undefined,
        day_high: undefined,
        day_low: undefined,
        previous_close: undefined,
        fifty_two_week_high: undefined,
        fifty_two_week_low: undefined,
        scraped_at: recentTimestamp,
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(mockData),
        }),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.fetchLiveFinancialData('TSLA', { useCacheIfFresh: true });

      expect(result.scrapedAt).toBe(recentTimestamp);
      expect(result.price).toBe(425.85);
    });

    it('should detect stale data (> 15 minutes old)', async () => {
      const staleTimestamp = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 mins ago
      const staleData = {
        symbol: 'TSLA',
        price: 420.00,
        scraped_at: staleTimestamp,
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(staleData),
        }),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.fetchLiveFinancialData('TSLA', { useCacheIfFresh: true });

      // Should return stale data with appropriate timestamp
      expect(result.price).toBe(420.00);
      expect(result.scrapedAt).toBe(staleTimestamp);
    });
  });

  describe('getAllFinancialData', () => {
    it('should return all available financial data from D1', async () => {
      const mockData = {
        results: Array.from({ length: 56 }, (_, i) => ({
          symbol: `TICK${i}`,
          price: 100 + i,
          currency: 'USD',
        })),
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockData),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.getAllFinancialData();

      expect(result).toHaveLength(56);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM power_network_financials')
      );
    });

    it('should filter by last scraped time window', async () => {
      const mockData = {
        results: [{ symbol: 'TSLA', price: 425.85 }],
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue(mockData),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const result = await service.getAllFinancialData({ hoursAgo: 24 });

      expect(result).toHaveLength(1);
      expect(mockD1.prepare).toHaveBeenCalledWith(
        expect.stringContaining("datetime('now', '-24 hours')")
      );
    });
  });

  describe('enrichEntityWithLiveData', () => {
    it('should enrich entity data with live financial data', async () => {
      const entity = {
        id: 'tesla',
        name: 'Tesla Inc.',
        type: 'company',
        ticker: 'TSLA',
        marketCap: 0.83, // Static old value in trillions
      };

      const liveData = {
        symbol: 'TSLA',
        price: 425.85,
        currency: 'USD',
        exchange: 'NASDAQ',
        market_cap: 1350000000000, // $1.35T
        volume: 150000000,
        day_high: 430.00,
        day_low: 420.00,
        previous_close: 420.00,
        fifty_two_week_high: 500.00,
        fifty_two_week_low: 300.00,
        scraped_at: '2025-09-24T10:00:00Z',
      };

      mockD1.prepare = vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(liveData),
        }),
      });

      const service = new PowerNetworkFinancialService(mockD1);
      const enriched = await service.enrichEntityWithLiveData(entity);

      expect(enriched.livePrice).toBe(425.85);
      expect(enriched.liveMarketCap).toBe(1.35); // In trillions
      expect(enriched.dayChangePercent).toBeCloseTo(1.39, 1); // (425.85 - 420) / 420 * 100 = 1.39
      expect(enriched.isLiveData).toBe(true);
    });

    it('should handle entities without tickers gracefully', async () => {
      const entity = {
        id: 'person-1',
        name: 'John Doe',
        type: 'person',
        netWorth: 10, // $10B
      };

      const service = new PowerNetworkFinancialService(mockD1);
      const enriched = await service.enrichEntityWithLiveData(entity);

      expect(enriched).toEqual({
        ...entity,
        isLiveData: false,
      });
      expect(mockD1.prepare).not.toHaveBeenCalled();
    });
  });
});