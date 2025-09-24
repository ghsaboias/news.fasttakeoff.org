import { NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';

/**
 * GET /api/power-network/relationships
 * Fetches power network relationships from D1 database
 * @returns {Promise<{ relationships: Array<[string, string, string]> } | { error: string }>}
 */
export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const url = new URL(request.url);
    const entityId = url.searchParams.get('entityId');
    const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

    let sql = `
      SELECT from_entity_id, to_entity_id, relationship_type
      FROM power_network_relationships
    `;

    const params: unknown[] = [];

    if (entityId) {
      sql += ' WHERE from_entity_id = ? OR to_entity_id = ?';
      params.push(entityId, entityId);
    }

    sql += ' ORDER BY from_entity_id, to_entity_id LIMIT ?';
    params.push(limit);

    const result = await env.FAST_TAKEOFF_NEWS_DB.prepare(sql)
      .bind(...params)
      .all();

    if (!result.success) {
      throw new Error(`Database query failed: ${result.error}`);
    }

    // Transform to the expected array format: [from, to, type]
    const relationships = result.results.map((row: Record<string, unknown>) => [
      row.from_entity_id,
      row.to_entity_id,
      row.relationship_type
    ]);

    return NextResponse.json(
      {
        relationships,
        meta: {
          total: relationships.length,
          hasMore: relationships.length === limit,
          entityId
        }
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      }
    );
  }, 'Failed to fetch power network relationships');
}