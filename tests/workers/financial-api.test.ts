import { describe, it, expect, beforeEach } from 'vitest';
import { SELF } from 'cloudflare:test';

describe('Power Network Financial Data API', () => {
  describe('GET /api/power-network/financial-data', () => {
    it('should return live financial data for a single company', async () => {
      const response = await SELF.fetch('/api/power-network/financial-data?symbol=TSLA');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        symbol: 'TSLA',
        price: expect.any(Number),
        currency: expect.any(String),
        volume: expect.any(Number),
        dayHigh: expect.any(Number),
        dayLow: expect.any(Number),
        fiftyTwoWeekHigh: expect.any(Number),
        fiftyTwoWeekLow: expect.any(Number),
        marketCap: expect.any(Number),
        previousClose: expect.any(Number),
        scrapedAt: expect.any(String),
      });
    });

    it('should return financial data for multiple companies', async () => {
      const response = await SELF.fetch('/api/power-network/financial-data?symbols=TSLA,AAPL,GOOGL');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeInstanceOf(Array);
      expect(data).toHaveLength(3);
      expect(data[0]).toMatchObject({
        symbol: expect.any(String),
        price: expect.any(Number),
      });
    });

    it('should return all available financial data when no symbols specified', async () => {
      const response = await fetch('/api/power-network/financial-data');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeInstanceOf(Array);
      expect(data.length).toBeGreaterThan(0);
    });

    it('should handle missing ticker gracefully', async () => {
      const response = await fetch('/api/power-network/financial-data?symbol=INVALID');

      expect(response.status).toBe(404);
      const error = await response.json();
      expect(error.error).toContain('not found');
    });

    it('should return fresh data not older than 24 hours', async () => {
      const response = await fetch('/api/power-network/financial-data?symbol=TSLA');
      const data = await response.json();

      const scrapedAt = new Date(data.scrapedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - scrapedAt.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeLessThan(24);
    });

    it('should include calculated market cap based on shares outstanding', async () => {
      const response = await fetch('/api/power-network/financial-data?symbol=AAPL');
      const data = await response.json();

      expect(data.marketCap).toBeDefined();
      expect(data.marketCap).toBeGreaterThan(1_000_000_000); // > $1B
      expect(data.sharesOutstanding).toBeDefined();
    });
  });
});