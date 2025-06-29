'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/ui/loader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ChartDataPoint {
    reportId: string;
    timestamp: string;
    messageCount: number;
    headline: string;
}

interface ChannelData {
    channelId: string;
    channelName: string;
    dataPoints: ChartDataPoint[];
}

interface TimeframeData {
    timeframe: string;
    channels: ChannelData[];
}

// Generate distinct colors for lines
const COLORS = [
    '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1',
    '#d084d0', '#82d982', '#ffb347', '#ff9999', '#67b7dc'
];

export default function ReportsChart() {
    const [chartData, setChartData] = useState<Record<string, TimeframeData> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchChartData();
    }, []);

    const fetchChartData = async () => {
        try {
            const response = await fetch('/api/reports/chart-data');
            if (!response.ok) {
                throw new Error('Failed to fetch chart data');
            }
            const data = await response.json();
            setChartData(data);
        } catch (err) {
            console.error('Error fetching chart data:', err);
            setError('Failed to load chart data');
        } finally {
            setLoading(false);
        }
    };

    const formatChartData = (timeframeData: TimeframeData) => {
        // Get all unique timestamps across all channels
        const allTimestamps = new Set<string>();
        timeframeData.channels.forEach(channel => {
            channel.dataPoints.forEach(point => {
                allTimestamps.add(point.timestamp);
            });
        });

        // Sort timestamps
        const sortedTimestamps = Array.from(allTimestamps).sort();

        // Create data points for the chart
        return sortedTimestamps.map(timestamp => {
            const dataPoint: Record<string, string | number | null> = {
                timestamp,
                date: new Date(timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            };

            // Add message count for each channel at this timestamp
            timeframeData.channels.forEach(channel => {
                const point = channel.dataPoints.find(p => p.timestamp === timestamp);
                dataPoint[channel.channelName] = point ? point.messageCount : null;
            });

            return dataPoint;
        });
    };

    interface TooltipProps {
        active?: boolean;
        payload?: Array<{
            name: string;
            value: number;
            color: string;
        }>;
        label?: string;
    }

    const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-background border rounded-lg shadow-lg p-3">
                    <p className="text-sm font-medium">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} className="text-sm" style={{ color: entry.color }}>
                            {entry.name}: {entry.value} messages
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <Card className="w-full">
                <CardContent className="flex items-center justify-center h-96">
                    <Loader />
                </CardContent>
            </Card>
        );
    }

    if (error || !chartData) {
        return (
            <Card className="w-full">
                <CardContent className="flex items-center justify-center h-96">
                    <p className="text-muted-foreground">{error || 'No data available'}</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Messages per Report by Channel</CardTitle>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="2h" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 max-w-[200px]">
                        <TabsTrigger value="2h">2 Hour</TabsTrigger>
                        <TabsTrigger value="6h">6 Hour</TabsTrigger>
                    </TabsList>

                    <TabsContent value="2h" className="mt-4">
                        {chartData['2h']?.channels.length > 0 ? (
                            <div className="h-96 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={formatChartData(chartData['2h'])}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                        />
                                        <YAxis
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                            label={{ value: 'Message Count', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        {chartData['2h'].channels.map((channel, index) => (
                                            <Line
                                                key={channel.channelId}
                                                type="monotone"
                                                dataKey={channel.channelName}
                                                stroke={COLORS[index % COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No 2-hour reports available</p>
                        )}
                    </TabsContent>

                    <TabsContent value="6h" className="mt-4">
                        {chartData['6h']?.channels.length > 0 ? (
                            <div className="h-96 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={formatChartData(chartData['6h'])}
                                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis
                                            dataKey="date"
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                        />
                                        <YAxis
                                            className="text-xs"
                                            tick={{ fill: 'currentColor' }}
                                            label={{ value: 'Message Count', angle: -90, position: 'insideLeft' }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        {chartData['6h'].channels.map((channel, index) => (
                                            <Line
                                                key={channel.channelId}
                                                type="monotone"
                                                dataKey={channel.channelName}
                                                stroke={COLORS[index % COLORS.length]}
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No 6-hour reports available</p>
                        )}
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
} 