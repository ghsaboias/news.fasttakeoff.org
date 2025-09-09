'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, AlertTriangle, CheckCircle, Clock, RefreshCw, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface CronStatus {
  type: string;
  outcome?: string;
  duration?: number;
  timestamp?: string;
  errorCount?: number;
  cpuTime?: number;
  taskDetails?: {
    task?: string;
    duration?: number;
    memoryDelta?: number;
  };
}

interface ConnectionStatus {
  connected: boolean;
  lastUpdate?: string;
  reconnectAttempts: number;
}

export default function CronMonitorDashboard() {
  const [liveMetrics, setLiveMetrics] = useState<CronStatus[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    reconnectAttempts: 0
  });
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connectToSSE = useCallback(() => {
    // Close existing connection
    if (eventSource) {
      eventSource.close();
    }

    const es = new EventSource('/api/admin/live-metrics');

    es.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus({
        connected: true,
        lastUpdate: new Date().toISOString(),
        reconnectAttempts: 0
      });
    };

    es.onerror = () => {
      console.error('SSE connection error');
      setConnectionStatus(prev => ({
        connected: false,
        lastUpdate: prev.lastUpdate,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
    };

    es.addEventListener('connected', (event) => {
      console.log('SSE connected event:', event.data);
    });

    es.addEventListener('cron_status', (event) => {
      try {
        const data = JSON.parse(event.data) as CronStatus[];
        console.log('Received cron status update:', data);
        setLiveMetrics(data);
        setConnectionStatus(prev => ({
          ...prev,
          lastUpdate: new Date().toISOString()
        }));
      } catch (error) {
        console.error('Error parsing cron status data:', error);
      }
    });

    es.addEventListener('error', (event) => {
      console.error('SSE error event:', event);
    });

    setEventSource(es);
  }, [eventSource]);

  useEffect(() => {
    connectToSSE();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [connectToSSE, eventSource]);

  const getStatusColor = (status: CronStatus) => {
    if (status.outcome === 'running') {
      return 'bg-blue-500';
    } else if (status.outcome === 'ok' && (status.errorCount || 0) === 0) {
      return 'bg-green-500';
    } else if (status.outcome === 'exception' || (status.errorCount || 0) > 0) {
      return 'bg-red-500';
    } else {
      return 'bg-yellow-500';
    }
  };

  const getStatusIcon = (status: CronStatus) => {
    if (status.outcome === 'running') {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    } else if (status.outcome === 'ok' && (status.errorCount || 0) === 0) {
      return <CheckCircle className="w-4 h-4" />;
    } else if (status.outcome === 'exception' || (status.errorCount || 0) > 0) {
      return <XCircle className="w-4 h-4" />;
    } else {
      return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp || timestamp === 'Never run') return timestamp || 'Never run';
    try {
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  const getCronDescription = (type: string) => {
    switch (type) {
      case '15min':
        return 'Messages + Window Evaluation';
      case '1h':
        return 'MktNews + Cache Maintenance';
      case '2h':
        return 'Feeds + Social Media';
      case '6h':
        return 'Executive Summary';
      case 'FEEDS_GERAL':
        return 'General News Feeds Processing';
      case 'FEEDS_MERCADO':
        return 'Market News Feeds Processing';
      case 'SOCIAL_MEDIA_POST':
        return 'Social Media Content Distribution';
      case 'EXECUTIVE_SUMMARY_6H':
        return 'Executive Summary Generation';
      case 'MESSAGES':
        return 'Discord Messages Collection';
      case 'WINDOW_EVALUATION':
        return 'Dynamic Report Window Analysis';
      case 'MKTNEWS_SUMMARY':
        return 'Market News Summary Generation';
      case 'MKTNEWS':
        return 'Market News Processing';
      default:
        return 'System Task';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Advanced Cron Monitor</CardTitle>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${connectionStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-muted-foreground">
                  {connectionStatus.connected ? 'Live updates active' : 'Connection lost'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (eventSource) {
                    eventSource.close();
                  }
                  connectToSSE();
                }}
                disabled={connectionStatus.connected}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Reconnect
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Live Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {liveMetrics.map((metric) => (
          <Card key={metric.type} className="relative">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-base font-semibold">
                  {metric.type}
                </CardTitle>
                <div className={`w-3 h-3 rounded-full ${getStatusColor(metric)}`} />
              </div>
              <p className="text-sm text-muted-foreground">
                {getCronDescription(metric.type)}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center space-x-2 text-sm">
                {getStatusIcon(metric)}
                <span>Status: {metric.outcome || 'unknown'}</span>
              </div>

              <div className="flex items-center space-x-2 text-sm">
                <Clock className="w-4 h-4" />
                <span>Duration: {formatDuration(metric.duration)}</span>
              </div>

              <div className="text-sm">
                <span className="text-muted-foreground">Last Run: </span>
                <span>{formatTimestamp(metric.timestamp)}</span>
              </div>

              {metric.cpuTime && (
                <div className="text-sm">
                  <span className="text-muted-foreground">CPU Time: </span>
                  <span>{formatDuration(metric.cpuTime)}</span>
                </div>
              )}

              {metric.taskDetails?.task && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Task: </span>
                  <Badge variant="secondary" className="text-xs">
                    {metric.taskDetails.task}
                  </Badge>
                </div>
              )}

              {metric.errorCount !== undefined && metric.errorCount > 0 && (
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-600">
                    {metric.errorCount} error{metric.errorCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {metric.taskDetails?.memoryDelta && (
                <div className="text-xs text-muted-foreground">
                  Memory: {(metric.taskDetails.memoryDelta / 1024 / 1024).toFixed(1)}MB
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connection Info */}
      {connectionStatus.lastUpdate && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Last update: {formatTimestamp(connectionStatus.lastUpdate)}</span>
              {connectionStatus.reconnectAttempts > 0 && (
                <span>Reconnect attempts: {connectionStatus.reconnectAttempts}</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {liveMetrics.length === 0 && connectionStatus.connected && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">Waiting for cron metrics data...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}