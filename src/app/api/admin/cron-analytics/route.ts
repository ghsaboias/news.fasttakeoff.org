import { withErrorHandling } from '@/lib/api-utils';


interface ExecutionLog {
  timestamp: string;
  cronType: string;
  outcome?: string;
  duration: number;
  cpuTime: number;
  errorCount: number;
  logCount: number;
  taskDetails?: {
    task?: string;
    duration?: number;
    memoryDelta?: number;
  };
}

export async function GET(request: Request) {
  return withErrorHandling(async (env) => {
    const url = new URL(request.url);
    const hours = Math.min(parseInt(url.searchParams.get('hours') || '24'), 168); // Max 7 days
    const cronType = url.searchParams.get('type') || 'all';
    // Get recent execution logs from KV
    const cronTypes = cronType === 'all' ? ['15min', '1h', '2h', '6h'] : [cronType];
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    
    const executionLogs: ExecutionLog[] = [];
    
    for (const type of cronTypes) {
      // List execution log keys for this cron type
      const listResponse = await env.CRON_STATUS_CACHE.list({
        prefix: `execution_${type}_`,
        limit: 100 // Limit to prevent too much data
      });

      for (const key of listResponse.keys) {
        // Extract timestamp from key (execution_{type}_{timestamp})
        const timestampStr = key.name.split('_').pop();
        const timestamp = parseInt(timestampStr || '0');
        
        if (timestamp >= cutoffTime) {
          const logData = await env.CRON_STATUS_CACHE.get(key.name, 'json');
          if (logData) {
            executionLogs.push(logData as ExecutionLog);
          }
        }
      }
    }

    // Sort by timestamp (newest first)
    executionLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate summary statistics
    const summary = {
      totalExecutions: executionLogs.length,
      successfulExecutions: executionLogs.filter(log => log.outcome === 'ok').length,
      failedExecutions: executionLogs.filter(log => log.outcome === 'exception').length,
      averageDuration: executionLogs.length > 0 
        ? executionLogs.reduce((sum, log) => sum + log.duration, 0) / executionLogs.length 
        : 0,
      averageCpuTime: executionLogs.length > 0 
        ? executionLogs.reduce((sum, log) => sum + log.cpuTime, 0) / executionLogs.length 
        : 0,
    };

    // Group by cron type for breakdown
    const breakdownByType: Record<string, {
      executions: number;
      successes: number;
      failures: number;
      avgDuration: number;
      lastExecution?: string;
    }> = {};

    for (const type of cronTypes) {
      const typeLogs = executionLogs.filter(log => log.cronType === type);
      breakdownByType[type] = {
        executions: typeLogs.length,
        successes: typeLogs.filter(log => log.outcome === 'ok').length,
        failures: typeLogs.filter(log => log.outcome === 'exception').length,
        avgDuration: typeLogs.length > 0 
          ? typeLogs.reduce((sum, log) => sum + log.duration, 0) / typeLogs.length 
          : 0,
        lastExecution: typeLogs.length > 0 ? typeLogs[0].timestamp : undefined
      };
    }

    // Recent executions (last 10)
    const recentExecutions = executionLogs.slice(0, 10).map(log => ({
      timestamp: log.timestamp,
      cronType: log.cronType,
      outcome: log.outcome,
      duration: log.duration,
      taskDetails: log.taskDetails
    }));

    return {
      timeRange: {
        hours,
        from: new Date(cutoffTime).toISOString(),
        to: new Date().toISOString()
      },
      summary,
      breakdownByType,
      recentExecutions,
      note: 'Analytics based on KV execution logs. For more detailed analytics, Analytics Engine integration is required.'
    };
  }, 'Failed to fetch analytics');
}