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
 * Initialize aggregated cron status with default placeholder values
 */
async function initializeAggregatedStatus(env: Cloudflare.Env, cronTypes: string[]): Promise<void> {
  try {
    console.log('[SSE] Initializing aggregated status with default values');
    const aggregatedStatuses: Record<string, CronStatusData> = {};

    // Create placeholder for all cron types
    for (const cronType of cronTypes) {
      aggregatedStatuses[cronType] = {
        type: cronType,
        outcome: 'unknown',
        duration: 0,
        timestamp: 'Never run',
        errorCount: 0
      };
    }

    // Write the aggregated status to KV
    await env.CRON_STATUS_CACHE.put(
      'cron_statuses_aggregated',
      JSON.stringify(aggregatedStatuses),
      { expirationTtl: 86400 } // 24 hours
    );
    console.log(`[SSE] Successfully initialized aggregated status for ${Object.keys(aggregatedStatuses).length} cron types`);
  } catch (error) {
    console.error('[SSE] Failed to initialize aggregated status:', error);
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
          const cronTypes = ['FEEDS_GERAL', 'FEEDS_MERCADO', 'SOCIAL_MEDIA_POST', 'EXECUTIVE_SUMMARY_6H', 'EXECUTIVE_SUMMARY', 'MESSAGES', 'WINDOW_EVALUATION', 'MKTNEWS_SUMMARY', 'MKTNEWS'];
          
          // Get aggregated statuses from KV cache
          let statuses = [];
          try {
            let aggregatedRaw = await Promise.race([
              env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
              new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 2000))
            ]);
            
            // If no aggregated data exists, initialize with defaults
            if (!aggregatedRaw) {
              console.log('[SSE] No aggregated data found, initializing with defaults');
              await initializeAggregatedStatus(env, cronTypes);
              // Try again after initialization
              try {
                aggregatedRaw = await Promise.race([
                  env.CRON_STATUS_CACHE.get('cron_statuses_aggregated'),
                  new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 1000))
                ]);
              } catch (retryError) {
                console.warn('[SSE] Initialization retry failed:', retryError);
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
            console.warn('[SSE] Aggregated status fetch failed:', error);
          }
          
          // If all else fails, create default statuses
          console.log('[SSE] Creating default statuses as fallback');
          statuses = cronTypes.map(cronType => ({ 
            type: cronType, 
            outcome: 'unknown',
            timestamp: 'Never run',
            duration: 0,
            errorCount: 0 
          }));

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