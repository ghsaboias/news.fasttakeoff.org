import { beforeEach } from 'vitest';

// Workers runtime setup file - avoid Node.js specific imports
beforeEach(() => {
  // Mock Yahoo Finance API for consistent test results
  globalThis.fetch = async (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('query1.finance.yahoo.com')) {
      return new Response(JSON.stringify({
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 425.85,
              currency: 'USD',
              exchangeName: 'NASDAQ',
              regularMarketDayHigh: 430.00,
              regularMarketDayLow: 420.00,
              regularMarketVolume: 150000000,
              regularMarketPreviousClose: 420.00,
              fiftyTwoWeekHigh: 500.00,
              fiftyTwoWeekLow: 300.00,
            },
          }],
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default mock response
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };
});