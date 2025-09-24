import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';

/**
 * GET /api/power-network/entities
 * Fetches power network entities from D1 database
 * @returns {Promise<{ entities: Record<string, PowerNetworkEntity> } | { error: string }>}
 */
export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const type = url.searchParams.get('type');
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

    let sql = `
      SELECT id, name, type, country, ticker, market_cap, net_worth, aum, created_at, updated_at
      FROM power_network_entities
    `;

    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search) {
      conditions.push('LOWER(name) LIKE ?');
      params.push(`%${search}%`);
    }

    if (type) {
      conditions.push('type = ?');
      params.push(type);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(limit);

    const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(sql)
      .bind(...params)
      .all();

    if (!result.success) {
      throw new Error(`Database query failed: ${result.error}`);
    }

    // Transform array to object keyed by id, matching the expected format
    const entities: Record<string, unknown> = {};
    result.results.forEach((row: Record<string, unknown>) => {
      const entityId = String(row.id);
      entities[entityId] = {
        id: row.id,
        name: row.name,
        type: row.type,
        country: row.country,
        ticker: row.ticker === 'null' ? null : row.ticker,
        marketCap: row.market_cap === 'null' ? null : row.market_cap,
        netWorth: row.net_worth === 'null' ? null : row.net_worth,
        aum: row.aum === 'null' ? null : row.aum,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json(
      {
        entities,
        meta: {
          total: result.results.length,
          hasMore: result.results.length === limit,
          search,
          type
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  }, 'Failed to fetch power network entities');
}