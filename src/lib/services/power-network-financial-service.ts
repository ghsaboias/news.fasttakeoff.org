import type { D1Database } from '@cloudflare/workers-types';

// Raw database row type from power_network_financials table
interface FinancialDataRow {
  symbol: string;
  price: number;
  currency?: string;
  exchange?: string;
  market_cap?: number;
  volume?: number;
  day_high?: number;
  day_low?: number;
  previous_close?: number;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  scraped_at: string;
}

export interface FinancialData {
  symbol: string;
  price?: number;
  currency?: string;
  exchange?: string;
  marketCap?: number;
  volume?: number;
  avgVolume?: number;
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  scrapedAt?: string;
}

export interface Entity {
  id: string;
  name: string;
  type: string;
  ticker?: string;
  marketCap?: number;
  netWorth?: number;
  aum?: number;
}

export interface EnrichedEntity extends Entity {
  livePrice?: number;
  liveMarketCap?: number;
  dayChangePercent?: number;
  isLiveData: boolean;
}

export interface GetFinancialDataOptions {
  useCacheIfFresh?: boolean;
  hoursAgo?: number;
}

export class PowerNetworkFinancialService {
  constructor(private db: D1Database) {}

  async fetchLiveFinancialData(symbol: string, options?: GetFinancialDataOptions): Promise<FinancialData | null> {
    const stmt = this.db.prepare(`
      SELECT * FROM power_network_financials
      WHERE symbol = ?
      ORDER BY scraped_at DESC
      LIMIT 1
    `);

    const result = await stmt.bind(symbol.toUpperCase()).first() as FinancialDataRow | null;

    if (!result) {
      return null;
    }

    // Check if data is fresh enough if caching is requested
    if (options?.useCacheIfFresh && result.scraped_at) {
      const scrapedTime = new Date(result.scraped_at).getTime();
      const now = Date.now();
      const ageInMinutes = (now - scrapedTime) / (1000 * 60);

      // If data is older than 15 minutes, consider refetching
      if (ageInMinutes > 15) {
        // In real implementation, this would trigger a fresh fetch
        // For now, return the stale data
        console.log(`[FINANCIAL_SERVICE] Stale data for ${symbol}, age: ${ageInMinutes} minutes`);
      }
    }

    return {
      symbol: result.symbol,
      price: result.price,
      currency: result.currency,
      exchange: result.exchange,
      marketCap: result.market_cap,
      volume: result.volume,
      dayHigh: result.day_high,
      dayLow: result.day_low,
      previousClose: result.previous_close,
      fiftyTwoWeekHigh: result.fifty_two_week_high,
      fiftyTwoWeekLow: result.fifty_two_week_low,
      scrapedAt: result.scraped_at,
    };
  }

  async fetchMultipleFinancialData(symbols: string[]): Promise<FinancialData[]> {
    if (symbols.length === 0) {
      return [];
    }

    const placeholders = symbols.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      SELECT * FROM power_network_financials
      WHERE symbol IN (${placeholders})
      AND scraped_at IN (
        SELECT MAX(scraped_at)
        FROM power_network_financials
        GROUP BY symbol
      )
      ORDER BY symbol
    `);

    const result = await stmt.bind(...symbols.map(s => s.toUpperCase())).all();

    return ((result.results as unknown) as FinancialDataRow[] || []).map((row) => ({
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      exchange: row.exchange,
      marketCap: row.market_cap,
      volume: row.volume,
      dayHigh: row.day_high,
      dayLow: row.day_low,
      previousClose: row.previous_close,
      fiftyTwoWeekHigh: row.fifty_two_week_high,
      fiftyTwoWeekLow: row.fifty_two_week_low,
      scrapedAt: row.scraped_at,
    }));
  }

  calculateMarketCap(price: number, sharesOutstanding: number): number {
    return price * sharesOutstanding;
  }

  async getAllFinancialData(options?: GetFinancialDataOptions): Promise<FinancialData[]> {
    let query = `
      SELECT * FROM power_network_financials
      WHERE scraped_at IN (
        SELECT MAX(scraped_at)
        FROM power_network_financials
        GROUP BY symbol
      )
    `;

    if (options?.hoursAgo) {
      query += ` AND scraped_at >= datetime('now', '-${options.hoursAgo} hours')`;
    }

    query += ' ORDER BY symbol';

    const stmt = this.db.prepare(query);
    const result = await stmt.all();

    return ((result.results as unknown) as FinancialDataRow[] || []).map((row) => ({
      symbol: row.symbol,
      price: row.price,
      currency: row.currency,
      exchange: row.exchange,
      marketCap: row.market_cap,
      volume: row.volume,
      dayHigh: row.day_high,
      dayLow: row.day_low,
      previousClose: row.previous_close,
      fiftyTwoWeekHigh: row.fifty_two_week_high,
      fiftyTwoWeekLow: row.fifty_two_week_low,
      scrapedAt: row.scraped_at,
    }));
  }

  async enrichEntityWithLiveData(entity: Entity): Promise<EnrichedEntity> {
    if (!entity.ticker) {
      return {
        ...entity,
        isLiveData: false,
      };
    }

    const liveData = await this.fetchLiveFinancialData(entity.ticker);

    if (!liveData) {
      return {
        ...entity,
        isLiveData: false,
      };
    }

    // Calculate market cap in trillions for consistency with static data
    const liveMarketCap = liveData.marketCap ? liveData.marketCap / 1_000_000_000_000 : undefined;

    // Calculate day change percentage if we have both current and previous close
    let dayChangePercent: number | undefined;
    if (liveData.price && liveData.previousClose) {
      dayChangePercent = ((liveData.price - liveData.previousClose) / liveData.previousClose) * 100;
    }

    return {
      ...entity,
      livePrice: liveData.price,
      liveMarketCap,
      dayChangePercent,
      isLiveData: true,
    };
  }
}