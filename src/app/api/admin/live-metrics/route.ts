import { getCacheContext } from '@/lib/utils';

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

      // Function to fetch and send cron status
      const fetchAndSendStatus = async () => {
        try {
          const cronTypes = ['FEEDS_GERAL', 'FEEDS_MERCADO', 'SOCIAL_MEDIA_POST', 'EXECUTIVE_SUMMARY_6H', 'MESSAGES', 'WINDOW_EVALUATION', 'MKTNEWS_SUMMARY', 'MKTNEWS'];
          const statuses = [];
          
          for (const cronType of cronTypes) {
            try {
              const rawStatus = await Promise.race([
                env.CRON_STATUS_CACHE.get(`status_${cronType}`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('KV_TIMEOUT')), 5000))
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