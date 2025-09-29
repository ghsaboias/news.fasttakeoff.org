'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface ChartDataPoint {
  date: string;
  [channelName: string]: string | number;
}

interface ChannelData {
  channel_name: string;
  date: string;
  total_messages: number;
}

const CHANNEL_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#FFA500', '#FF69B4', '#20B2AA',
  '#9370DB', '#3CB371', '#FFD700', '#FF1493', '#00CED1',
  '#FF4500', '#DA70D6', '#32CD32', '#FF8C00', '#4B0082'
];

export default function MessageVolumeChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedChannels, setSelectedChannels] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/charts/message-volume?range=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const rawData: ChannelData[] = await response.json();

      // Group data by date and build chart structure
      const groupedData = rawData.reduce((acc, item) => {
        if (!acc[item.date]) {
          acc[item.date] = { date: item.date };
        }
        acc[item.date][item.channel_name] = item.total_messages;
        return acc;
      }, {} as Record<string, ChartDataPoint>);

      // Convert to array and sort by date
      const chartData = Object.values(groupedData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Extract unique channel names
      const uniqueChannels = [...new Set(rawData.map(item => item.channel_name))];

      // Initialize selected channels (top 5 by total volume)
      const channelVolumes = uniqueChannels.map(channel => ({
        channel,
        total: rawData
          .filter(d => d.channel_name === channel)
          .reduce((sum, d) => sum + d.total_messages, 0)
      }));

      const topChannels = channelVolumes
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map(c => c.channel);

      setChannels(uniqueChannels);
      setSelectedChannels(new Set(topChannels));
      setData(chartData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleChannel = (channel: string) => {
    const newSelected = new Set(selectedChannels);
    if (newSelected.has(channel)) {
      newSelected.delete(channel);
    } else {
      newSelected.add(channel);
    }
    setSelectedChannels(newSelected);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatTooltipDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-96">
          <p className="text-red-500">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Message Volume by Channel</CardTitle>
            <CardDescription>
              Total messages processed in reports over time
            </CardDescription>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="90d">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <p className="text-sm text-muted-foreground mb-2">Click channels to toggle:</p>
          <div className="flex flex-wrap gap-2">
            {channels.map((channel, channelIdx) => (
              <button
                key={channel}
                onClick={() => toggleChannel(channel)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedChannels.has(channel)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                style={{
                  backgroundColor: selectedChannels.has(channel)
                    ? CHANNEL_COLORS[channelIdx % CHANNEL_COLORS.length]
                    : undefined,
                  color: selectedChannels.has(channel) ? 'white' : undefined
                }}
              >
                {channel}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis className="text-xs" />
            <Tooltip
              labelFormatter={formatTooltipDate}
              contentStyle={{
                backgroundColor: 'hsl(var(--background))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px'
              }}
            />
            <Legend />

            {Array.from(selectedChannels).map((channel) => {
              const channelIndex = channels.indexOf(channel);
              return (
                <Area
                  key={channel}
                  type="monotone"
                  dataKey={channel}
                  stackId="1"
                  stroke={CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length]}
                  fill={CHANNEL_COLORS[channelIndex % CHANNEL_COLORS.length]}
                  fillOpacity={0.6}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}