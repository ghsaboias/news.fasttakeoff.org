import { withErrorHandling } from '@/lib/api-utils';
import { NextResponse } from 'next/server';
import { WindService } from '@/lib/data/wind-service';

/**
 * GET /api/wind-data
 * Returns the latest wind data for globe visualization
 */
export async function GET() {
  return withErrorHandling(async (env) => {
    const windService = new WindService(env);

    // Get latest wind data grid
    const windGrid = await windService.getWindDataGrid();

    if (!windGrid) {
      // No data available yet
      return NextResponse.json({
        points: [],
        count: 0,
        fetchedAt: null,
        model: null,
        gridResolution: null,
        message: 'No wind data available yet. Data will be fetched during the next daily cron job.'
      });
    }

    return NextResponse.json({
      points: windGrid.points,
      count: windGrid.points.length,
      fetchedAt: windGrid.fetchedAt,
      model: windGrid.model,
      gridResolution: windGrid.gridResolution,
      coverage: windGrid.coverage
    });
  }, 'Failed to fetch wind data');
}
