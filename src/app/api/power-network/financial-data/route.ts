import { withErrorHandling } from '@/lib/api-utils';
import { PowerNetworkFinancialService } from '@/lib/services/power-network-financial-service';
import { NextRequest } from 'next/server';

/**
 * GET /api/power-network/financial-data
 * Fetches financial data for Power Network companies
 * @param request - Query params: symbol (single), symbols (comma-separated), hoursAgo (optional)
 * @returns {Promise<NextResponse>} Array of financial data objects
 * @throws 404 if no data found, 500 for errors
 */
export async function GET(request: NextRequest) {
  return withErrorHandling(async (env) => {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const symbols = searchParams.get('symbols');
    const hoursAgoParam = searchParams.get('hoursAgo');

    const service = new PowerNetworkFinancialService(env.FAST_TAKEOFF_NEWS_DB);

    // Parse optional filter parameters
    const options = hoursAgoParam ? { hoursAgo: parseInt(hoursAgoParam, 10) } : undefined;

    try {
      if (symbol) {
        // Single company request
        const result = await service.fetchLiveFinancialData(symbol.toUpperCase());

        if (!result) {
          return { error: `Financial data not found for symbol ${symbol}` };
        }

        return result;

      } else if (symbols) {
        // Multiple companies request
        const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
        const results = await service.fetchMultipleFinancialData(symbolList);

        return results;

      } else {
        // All companies request
        const results = await service.getAllFinancialData(options);

        return results;
      }

    } catch (error) {
      console.error('[POWER_NETWORK_API] Error fetching financial data:', error);
      throw error; // Let withErrorHandling handle the error response
    }

  }, 'Failed to fetch financial data');
}