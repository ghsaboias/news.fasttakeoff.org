import { getCacheContext } from '@/lib/utils';
import { Cloudflare } from '../../../../../worker-configuration';

interface CronStatusData {
  type: string;
  outcome: string;
  duration: number;
  timestamp: string;
  errorCount: number;
  cpuTime?: number;
  taskDetails?: {
    task: string;
    duration: number;
    memoryDelta?: number;
    error?: string;
  };
}

/**
 * Bootstrap aggregated cron status by reading existing individual entries
 * and creating a single aggregated entry for performance optimization
 */
async function bootstrapAggregatedStatus(env: Cloudflare.Env, cronTypes: string[]): Promise<void> {
  try {
    console.log('[SSE] Starting bootstrap process for aggregated status');
    const aggregatedStatuses: Record<string, CronStatusData> = {};

    // Read individual status entries with timeout protection
    for (const cronType of cronTypes) {
      try {
        const rawStatus = await Promise.race([
          env.CRON_STATUS_CACHE.get(`status_${cronType}`),
          new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 1000))
        ]);

        if (rawStatus && typeof rawStatus === 'string') {
          const status = JSON.parse(rawStatus);
          aggregatedStatuses[cronType] = {
            type: cronType,
            outcome: status.outcome,
            duration: status.duration,
            timestamp: status.timestamp,
            errorCount: status.errorCount || 0,
            cpuTime: status.cpuTime,
            taskDetails: status.taskDetails
          };
          console.log(`[SSE] Bootstrapped status for ${cronType}: ${status.outcome}`);
        } else {
          // Create placeholder for jobs that haven't run yet
          aggregatedStatuses[cronType] = {
            type: cronType,
            outcome: 'unknown',
            duration: 0,
            timestamp: 'Never run',
            errorCount: 0
          };
          console.log(`[SSE] Created placeholder status for ${cronType}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.warn(`[SSE] Failed to bootstrap ${cronType}:`, errorMsg);
        
        // Create error placeholder
        aggregatedStatuses[cronType] = {
          type: cronType,
          outcome: 'unknown',
          duration: 0,
          timestamp: 'Never run',
          errorCount: 0
        };
      }
    }

    // Write the aggregated status to KV
    try {
      await env.CRON_STATUS_CACHE.put(
        'cron_statuses_aggregated',
        JSON.stringify(aggregatedStatuses),
        { expirationTtl: 86400 } // 24 hours
      );
      console.log(`[SSE] Successfully bootstrapped aggregated status for ${Object.keys(aggregatedStatuses).length} cron types`);
    } catch (putError) {
      console.error('[SSE] Failed to write bootstrapped aggregated status:', putError);
      throw putError;
    }
  } catch (error) {
    console.error('[SSE] Bootstrap process failed:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const { env } = await getCacheContext();
    
    // Create a ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        
        const sendEvent = (event: string, data: unknown) => {
          try {
            const formatted = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(formatted));
          } catch (error) {
            console.error(`[SSE] Failed to send event ${event}:`, error);
          }
        };

      // Send initial connection event
      sendEvent('connected', { timestamp: new Date().toISOString() });

      // Function to fetch and send cron status (optimized to use aggregated KV entry)
      const fetchAndSendStatus = async () => {
        try {
          const cronTypes = ['FEEDS_GERAL', 'FEEDS_MERCADO', 'SOCIAL_MEDIA_POST', 'EXECUTIVE_SUMMARY_6H', 'MESSAGES', 'WINDOW_EVALUATION', 'MKTNEWS_SUMMARY', 'MKTNEWS'];
          
          // Try to get aggregated statuses first (performance optimization)
          let statuses = [];
          try {
            let aggregatedRaw = await Promise.race([
              env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 2000)) // Reduced timeout
            ]);
            
            // If no aggregated data exists, bootstrap it from individual entries
            if (!aggregatedRaw) {
              console.log('[SSE] No aggregated data found, bootstrapping from individual entries');
              await bootstrapAggregatedStatus(env, cronTypes);
              // Try again after bootstrapping
              try {
                aggregatedRaw = await Promise.race([
                  env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 1000))
                ]);
              } catch (retryError) {
                console.warn('[SSE] Bootstrap retry failed:', retryError);
              }
            }
            
            if (aggregatedRaw && typeof aggregatedRaw === 'string') {
              const aggregatedStatuses = JSON.parse(aggregatedRaw);
              
              // Convert aggregated data to array format expected by frontend
              statuses = cronTypes.map(cronType => {
                const status = aggregatedStatuses[cronType];
                if (status) {
                  return { type: cronType, ...status };
                } else {
                  return { 
                    type: cronType, 
                    outcome: 'unknown',
                    timestamp: 'Never run',
                    duration: 0,
                    errorCount: 0 
                  };
                }
              });
              
              console.log(`[SSE] Successfully fetched aggregated cron statuses (${statuses.length} jobs)`);
              sendEvent('cron_status', statuses);
              return;
            }
          } catch (error) {
            console.warn('[SSE] Aggregated status fetch failed, falling back to individual queries:', error);
          }
          
          // Fallback: fetch individual statuses (for backward compatibility)
          console.log('[SSE] Using fallback individual KV queries');
          for (const cronType of cronTypes) {
            try {
              const rawStatus = await Promise.race([
                env.CRON_STATUS_CACHE.get(`status_${cronType}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 2000)) // Reduced timeout
              ]);
              
              let status = null;
              if (rawStatus && typeof rawStatus === 'string') {
                try {
                  status = JSON.parse(rawStatus);
                } catch (parseError) {
                  console.error(`[SSE] Failed to parse ${cronType} status:`, parseError);
                }
              }
              
              if (status) {
                statuses.push({ type: cronType, ...status });
              } else {
                statuses.push({ 
                  type: cronType, 
                  outcome: 'unknown',
                  timestamp: 'Never run',
                  duration: 0,
                  errorCount: 0 
                });
              }
              
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              if (errorMsg !== 'KV_TIMEOUT') {
                console.error(`[SSE] Error fetching ${cronType} status:`, errorMsg);
              }
              statuses.push({ 
                type: cronType, 
                outcome: 'error',
                timestamp: new Date().toISOString(),
                duration: 0,
                errorCount: 1,
                error: errorMsg
              });
            }
          }

          sendEvent('cron_status', statuses);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error('[SSE] Failed to fetch cron statuses:', errorMsg);
          sendEvent('error', { message: 'Failed to fetch cron statuses', error: errorMsg });
        }
      };

      // Send status immediately
      fetchAndSendStatus();

      // Set up interval to send updates every 5 seconds
      const interval = setInterval(fetchAndSendStatus, 5000);

      // Handle client disconnection
      const cleanup = () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (error) {
          // Stream already closed
          console.error('[SSE] Error closing stream:', error);
        }
      };

      // Set a maximum connection time of 5 minutes to prevent resource leaks
      const timeout = setTimeout(cleanup, 5 * 60 * 1000);

      // Store cleanup function for potential use
      (controller as ReadableStreamDefaultController & { cleanup?: () => void }).cleanup = () => {
        clearTimeout(timeout);
        cleanup();
      };
    },

    cancel() {
      // Called when client disconnects
      console.log('[SSE] Client disconnected');
    }
  });

  // Return SSE response
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
  } catch (error) {
    console.error('[SSE] Failed to create SSE stream:', error);
    return new Response(JSON.stringify({ error: 'Failed to stream live metrics' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}