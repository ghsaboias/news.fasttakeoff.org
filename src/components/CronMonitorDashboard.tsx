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

interface LoadingStatus {
  isLoading: boolean;
  lastUpdate?: string;
  error?: string;
}

export default function CronMonitorDashboard() {
  const [cronMetrics, setCronMetrics] = useState<CronStatus[]>([]);
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    isLoading: false
  });

  const fetchCronStatus = useCallback(async () => {
    setLoadingStatus(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const response = await fetch('/api/admin/cron-status');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as CronStatus[];
      setCronMetrics(data);
      setLoadingStatus({
        isLoading: false,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLoadingStatus({
        isLoading: false,
        error: errorMessage
      });
      console.error('Failed to fetch cron status:', error);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchCronStatus();

    // Set up polling every 30 seconds
    const interval = setInterval(fetchCronStatus, 30000);

    return () => clearInterval(interval);
  }, [fetchCronStatus]);

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
        return 'Feeds + Social Media (Legacy)';
      case '6h':
        return 'Executive Summary Only';
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
      {/* Status Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cron Monitor</CardTitle>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  loadingStatus.isLoading ? 'bg-blue-500' :
                  loadingStatus.error ? 'bg-red-500' : 'bg-green-500'
                }`} />
                <span className="text-sm text-muted-foreground">
                  {loadingStatus.isLoading ? 'Loading...' :
                   loadingStatus.error ? `Error: ${loadingStatus.error}` :
                   'Data loaded'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchCronStatus}
                disabled={loadingStatus.isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${loadingStatus.isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Cron Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cronMetrics.map((metric) => (
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

      {/* Update Info */}
      {loadingStatus.lastUpdate && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Last update: {formatTimestamp(loadingStatus.lastUpdate)}</span>
              <span>Auto-refresh every 30 seconds</span>
            </div>
          </CardContent>
        </Card>
      )}

      {cronMetrics.length === 0 && !loadingStatus.isLoading && !loadingStatus.error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No cron metrics data available</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}