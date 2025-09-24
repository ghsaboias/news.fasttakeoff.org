import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TickerExtractor } from '@/lib/utils/ticker-extractor';

describe('PowerNetworkTickerExtractor', () => {
  let graphData: any;

  beforeEach(() => {
    // Mock the graph.json data structure
    graphData = {
      nodes: [
        {
          id: 'tesla',
          name: 'Tesla Inc.',
          type: 'company',
          ticker: 'TSLA',
          marketCap: 0.83,
        },
        {
          id: 'apple',
          name: 'Apple Inc.',
          type: 'company',
          ticker: 'AAPL',
          marketCap: 3.5,
        },
        {
          id: 'spacex',
          name: 'SpaceX',
          type: 'company',
          ticker: 'SPACE',
          fetchTicker: null, // Private company
          marketCap: 0.18,
        },
        {
          id: 'person-1',
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
        {
          id: 'nvidia',
          name: 'NVIDIA Corporation',
          type: 'company',
          ticker: 'NVDA',
          marketCap: 3.2,
        },
      ],
      edges: [
        { source: 'person-1', target: 'tesla' },
        { source: 'person-1', target: 'spacex' },
      ],
    };
  });

  describe('extractAllTickers', () => {
    it('should extract all unique tickers from graph.json', () => {
      const extractor = new TickerExtractor(graphData);
      const tickers = extractor.extractAllTickers();

      expect(tickers).toEqual(expect.arrayContaining(['TSLA', 'AAPL', 'NVDA']));
      expect(tickers).not.toContain('SPACE'); // Private company
      expect(tickers).toHaveLength(3);
    });

    it('should handle fetchTicker overrides', () => {
      graphData.nodes.push({
        id: 'berkshire',
        name: 'Berkshire Hathaway',
        type: 'company',
        ticker: 'BRK',
        fetchTicker: 'BRK-B', // Use Class B shares for fetching
        marketCap: 0.9,
      });

      const extractor = new TickerExtractor(graphData);
      const tickers = extractor.extractTickersWithOverrides();

      expect(tickers).toContainEqual({
        ticker: 'BRK',
        fetchTicker: 'BRK-B',
        entityId: 'berkshire',
        name: 'Berkshire Hathaway',
      });
    });

    it('should identify missing tickers from current collection', () => {
      const currentlyFetched = ['TSLA', 'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'META', 'NVDA'];
      const extractor = new TickerExtractor(graphData);

      // Add more companies to graph
      graphData.nodes.push(
        { id: 'google', ticker: 'GOOGL', type: 'company' },
        { id: 'microsoft', ticker: 'MSFT', type: 'company' },
        { id: 'amazon', ticker: 'AMZN', type: 'company' },
        { id: 'meta', ticker: 'META', type: 'company' },
        { id: 'netflix', ticker: 'NFLX', type: 'company' },
        { id: 'adobe', ticker: 'ADBE', type: 'company' },
      );

      const missing = extractor.getMissingTickers(currentlyFetched);

      expect(missing).toContain('NFLX');
      expect(missing).toContain('ADBE');
      expect(missing).not.toContain('TSLA');
      expect(missing).not.toContain('GOOGL');
    });

    it('should group companies by exchange', () => {
      graphData.nodes = [
        { id: '1', ticker: 'TSLA', exchange: 'NASDAQ', type: 'company' },
        { id: '2', ticker: 'AAPL', exchange: 'NASDAQ', type: 'company' },
        { id: '3', ticker: 'JPM', exchange: 'NYSE', type: 'company' },
        { id: '4', ticker: 'BAC', exchange: 'NYSE', type: 'company' },
        { id: '5', ticker: 'BABA', exchange: 'NYSE', type: 'company' },
      ];

      const extractor = new TickerExtractor(graphData);
      const grouped = extractor.groupByExchange();

      expect(grouped.NASDAQ).toEqual(['TSLA', 'AAPL']);
      expect(grouped.NYSE).toEqual(['JPM', 'BAC', 'BABA']);
    });

    it('should extract only companies with market cap above threshold', () => {
      const extractor = new TickerExtractor(graphData);
      const largeCaps = extractor.extractByMarketCapThreshold(1.0); // $1T+

      expect(largeCaps).toContain('AAPL'); // $3.5T
      expect(largeCaps).toContain('NVDA'); // $3.2T
      expect(largeCaps).not.toContain('TSLA'); // $0.83T
    });
  });

  describe('loadGraphData', () => {
    it('should load and parse graph.json from file system', async () => {
      const mockReadFile = vi.spyOn(fs.promises, 'readFile');
      mockReadFile.mockResolvedValue(JSON.stringify(graphData));

      const extractor = await TickerExtractor.fromFile('/public/data/graph.json');
      const tickers = extractor.extractAllTickers();

      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('graph.json'),
        'utf-8'
      );
      expect(tickers).toContain('TSLA');
    });

    it('should handle malformed graph.json gracefully', async () => {
      const mockReadFile = vi.spyOn(fs.promises, 'readFile');
      mockReadFile.mockResolvedValue('{ invalid json }');

      await expect(TickerExtractor.fromFile('/public/data/graph.json'))
        .rejects.toThrow('Failed to parse graph.json');
    });
  });

  describe('getCompanyMetadata', () => {
    it('should return full metadata for a ticker', () => {
      const extractor = new TickerExtractor(graphData);
      const metadata = extractor.getCompanyMetadata('TSLA');

      expect(metadata).toEqual({
        id: 'tesla',
        name: 'Tesla Inc.',
        type: 'company',
        ticker: 'TSLA',
        marketCap: 0.83,
        fetchTicker: undefined,
      });
    });

    it('should return null for non-existent ticker', () => {
      const extractor = new TickerExtractor(graphData);
      const metadata = extractor.getCompanyMetadata('INVALID');

      expect(metadata).toBeNull();
    });
  });

  describe('generateQueueMessages', () => {
    it('should generate queue messages for all valid tickers', () => {
      const extractor = new TickerExtractor(graphData);
      const messages = extractor.generateQueueMessages();

      expect(messages).toHaveLength(3); // TSLA, AAPL, NVDA
      expect(messages[0]).toEqual({
        ticker: 'TSLA',
        fetchTicker: undefined,
        entityId: 'tesla',
        name: 'Tesla Inc.',
        marketCap: 0.83,
        timestamp: expect.any(String),
      });
    });

    it('should exclude private companies and non-companies', () => {
      const extractor = new TickerExtractor(graphData);
      const messages = extractor.generateQueueMessages();

      const tickers = messages.map(m => m.ticker);
      expect(tickers).not.toContain('SPACE'); // Private company
      expect(messages.every(m => m.entityId !== 'person-1')).toBe(true);
      expect(messages.every(m => m.entityId !== 'fund-1')).toBe(true);
    });
  });
});