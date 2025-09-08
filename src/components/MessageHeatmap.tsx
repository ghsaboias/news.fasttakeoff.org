'use client'

import { useApi } from '@/lib/hooks';
import React, { useMemo, useState } from 'react';

interface HourlyData {
    hour: number
    count: number
}

interface ChannelHeatmapData {
    channelId: string
    channelName: string
    hourlyData: HourlyData[]
    totalMessages: number
}

interface HeatmapResponse {
    channels: ChannelHeatmapData[]
    lastUpdated: string
    timeRange: {
        start: string
        end: string
    }
}

// Removed TooltipData interface - using CSS tooltips now

const fetchHeatmapData = async () => {
    const response = await fetch('/api/messages/heatmap');
    if (!response.ok) {
        throw new Error('Failed to fetch heatmap data');
    }
    return response.json();
};

function MessageHeatmap() {
    const [channelFilter, setChannelFilter] = useState<string>('')
    const [showInactiveChannels, setShowInactiveChannels] = useState<boolean>(false)
    const [channelsToShow, setChannelsToShow] = useState<number>(20)

    // Constants for layout and dimensions
    const CONSTANTS = useMemo(() => ({
        CELL_HEIGHT: 32,
        LABEL_HEIGHT: 24,
        LEFT_MARGIN: 120,
        SVG_WIDTH: 900,
        CHART_WIDTH: 750,
        MIN_WIDTH: 700,
        TOOLTIP_WIDTH: 200,
        TOOLTIP_HEIGHT: 60,
        TIME_LABELS: [0, 4, 8, 12, 16, 20],
        UPDATE_INTERVAL: 300000, // 5 minutes in ms
    }), [])

    const { data, loading, error } = useApi<HeatmapResponse>(
        fetchHeatmapData as () => Promise<HeatmapResponse>, {
        pollInterval: CONSTANTS.UPDATE_INTERVAL,
    });

    const getColorIntensity = (count: number, maxCount: number): string => {
        // Dark-theme friendly, brand-aligned green/teal scale
        // Zero activity: blend with dark background grid
        if (count === 0) return '#1f2937' // dark-800

        const intensity = Math.min(count / maxCount, 1)

        if (intensity < 0.25) return '#0b3f35' // deep teal
        if (intensity < 0.5) return '#0d6b5a'  // primary teal
        if (intensity < 0.75) return '#158a73' // hover teal
        return '#1db39c' // accent green (highest)
    }

    const formatUTCTime = (utcHour: number): string => {
        // Format UTC hour in 12-hour format
        if (utcHour === 0) return '12am'
        if (utcHour === 12) return '12pm'
        if (utcHour < 12) return `${utcHour}am`
        return `${utcHour - 12}pm`
    }

    const formatLocalTime = (utcHour: number): string => {
        // Create a date representing the UTC hour today, then convert to local time
        const now = new Date()
        const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour, 0, 0))

        return utcDate.toLocaleTimeString(undefined, {
            hour: 'numeric',
            hour12: true
        }).replace(':00', '').replace(' ', '').toLowerCase()
    }

    // CSS tooltips are much faster - no need for JavaScript handlers

    // Memoize expensive calculations (must be before conditional returns)
    const { filteredChannels, timeLabels, maxCountForScale } = useMemo(() => {
        if (!data?.channels) {
            return {
                filteredChannels: [],
                timeLabels: CONSTANTS.TIME_LABELS.map(hour => ({
                    hour,
                    label: `${formatUTCTime(hour)} UTC`,
                    x: (hour / 24) * 100
                })),
                maxCountForScale: 1
            }
        }

        // Filter channels based on activity and search term
        let channelsFiltered = showInactiveChannels
            ? data.channels
            : data.channels.filter(channel => channel.totalMessages > 0)

        // Apply search filter
        if (channelFilter.trim()) {
            channelsFiltered = channelsFiltered.filter(channel =>
                channel.channelName.toLowerCase().includes(channelFilter.toLowerCase())
            )
        }

        // Sort by total messages (descending) and limit to channelsToShow
        const channelsSorted = channelsFiltered.sort((a, b) => b.totalMessages - a.totalMessages)
        const channelsLimited = channelsSorted.slice(0, channelsToShow)

        // Calculate global maximum for color scaling across all channels
        const allHourlyCounts = channelsLimited.flatMap(channel =>
            channel.hourlyData.map(h => h.count)
        )

        const maxCountForScale = Math.max(...allHourlyCounts, 1) // Use global max, minimum of 1

        // Generate time labels based on the actual data chronology
        // Show labels every 4 hours in the chronological sequence
        const timeLabels: Array<{ hour: number; label: string; x: number }> = [];

        if (channelsLimited.length > 0) {
            // Use the first channel's hourly data as reference for chronological order
            const referenceHourlyData = channelsLimited[0].hourlyData;

            // Show every 4th hour (positions 0, 4, 8, 12, 16, 20)
            for (let i = 0; i < 24; i += 4) {
                if (i < referenceHourlyData.length) {
                    const hour = referenceHourlyData[i].hour;
                    timeLabels.push({
                        hour,
                        label: `${formatUTCTime(hour)} UTC`,
                        x: (i / 24) * 100  // Position based on chronological index, not hour number
                    });
                }
            }
        } else {
            // Fallback to original behavior if no data
            timeLabels.push(...CONSTANTS.TIME_LABELS.map(hour => ({
                hour,
                label: `${formatUTCTime(hour)} UTC`,
                x: (hour / 24) * 100
            })));
        }

        return { filteredChannels: channelsLimited, timeLabels, maxCountForScale }
    }, [data?.channels, channelFilter, showInactiveChannels, channelsToShow, CONSTANTS.TIME_LABELS])
    const rowHeight = CONSTANTS.CELL_HEIGHT
    const labelHeight = CONSTANTS.LABEL_HEIGHT
    const leftMargin = CONSTANTS.LEFT_MARGIN // Space for channel names

    return (
        <div className="w-full bg-dark-900 rounded-lg border border-dark-700 p-4 shadow-dark">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-100">
                    Sources Heatmap (Last 24 Hours)
                </h3>
                {data && (
                    <div className="text-xs text-dark-400">
                        Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Filter Controls - Always visible */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b border-dark-700">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value)}
                        className="px-3 py-1 text-sm rounded-md bg-dark-800 text-dark-100 placeholder:text-dark-500 border border-dark-600 focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={loading}
                    />
                </div>
                <label className="flex items-center gap-2 text-sm text-dark-200">
                    <input
                        type="checkbox"
                        checked={showInactiveChannels}
                        onChange={(e) => setShowInactiveChannels(e.target.checked)}
                        className="rounded accent-accent"
                        disabled={loading}
                    />
                    Show inactive channels
                </label>
            </div>

            {/* Content Area */}
            {loading && (
                <div className="flex items-center justify-center h-32 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="text-sm text-dark-400">Loading activity data...</div>
                </div>
            )}

            {!loading && (error || !data) && (
                <div className="flex items-center justify-center h-32 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="text-sm text-dark-400">Unable to load activity data</div>
                </div>
            )}

            {!loading && data && filteredChannels.length === 0 && (
                <div className="flex items-center justify-center h-32 bg-dark-800 rounded-lg border border-dark-700">
                    <div className="text-sm text-dark-400">
                        {channelFilter ? 'No channels match your search' : 'No channel activity in the last 24 hours'}
                    </div>
                </div>
            )}

            {!loading && data && filteredChannels.length > 0 && (
                <>
                    <div className="relative w-full overflow-x-auto">
                        <svg
                            width="100%"
                            height={filteredChannels.length * rowHeight + labelHeight + 10}
                            className="min-w-[700px]"
                            viewBox={`0 0 900 ${filteredChannels.length * rowHeight + labelHeight + 10}`}
                        >
                            {/* Time labels */}
                            {timeLabels.map(({ hour, label, x }: { hour: number; label: string; x: number }) => (
                                <text
                                    key={hour}
                                    x={leftMargin + (x / 100) * (CONSTANTS.CHART_WIDTH - leftMargin)}
                                    y={labelHeight - 4}
                                    textAnchor="middle"
                                    className="text-xs fill-dark-400"
                                >
                                    {label}
                                </text>
                            ))}

                            {/* Channel rows */}
                            {filteredChannels.map((channel: ChannelHeatmapData, channelIndex: number) => (
                                <g key={channel.channelId}>
                                    {/* Channel label */}
                                    <text
                                        x={leftMargin - 8}
                                        y={labelHeight + channelIndex * rowHeight + rowHeight / 2 + 4}
                                        textAnchor="end"
                                        className="text-sm fill-dark-300"
                                    >
                                        {channel.channelName}
                                    </text>

                                    {/* Hour cells */}
                                    {channel.hourlyData.map((hourData: HourlyData, hourIndex: number) => {
                                        // Use hourIndex for positioning (chronological order)
                                        const cellX = leftMargin + (hourIndex / 24) * (CONSTANTS.CHART_WIDTH - leftMargin);
                                        const cellWidth = (CONSTANTS.CHART_WIDTH - leftMargin) / 24;

                                        const utcTime = formatUTCTime(hourData.hour)

                                        return (
                                            <rect
                                                key={hourData.hour}
                                                x={cellX}
                                                y={labelHeight + channelIndex * rowHeight + 4}
                                                width={cellWidth - 1}
                                                height={rowHeight - 8}
                                                fill={getColorIntensity(hourData.count, maxCountForScale)}
                                                stroke="#374151" /* dark-700 */
                                                strokeWidth="0.5"
                                                className="cursor-pointer hover:stroke-dark-500"
                                                onMouseEnter={(e) => {
                                                    const rect = e.currentTarget

                                                    if (rect.ownerSVGElement) {
                                                        const tooltip = rect.ownerSVGElement?.querySelector('#tooltip-bg') as SVGRectElement
                                                        const tooltipText = rect.ownerSVGElement?.querySelector('#tooltip-text') as SVGTextElement

                                                        if (tooltip && tooltipText) {
                                                            const localTime = formatLocalTime(hourData.hour)
                                                            const nextLocalTime = formatLocalTime((hourData.hour + 1) % 24)
                                                            const content = `${channel.channelName} - ${utcTime}-${formatUTCTime((hourData.hour + 1) % 24)} UTC (${localTime}-${nextLocalTime} local): ${hourData.count} messages`

                                                            // Set text content first to measure it
                                                            tooltipText.textContent = content

                                                            // Get the bounding box of the text to determine width
                                                            const textBBox = tooltipText.getBBox()
                                                            const padding = 16 // 8px padding on each side
                                                            const tooltipWidth = textBBox.width + padding
                                                            const tooltipHeight = 30

                                                            // Position tooltip above the cell, ensuring it stays within bounds
                                                            const tooltipX = Math.max(10, Math.min(cellX - tooltipWidth / 2, CONSTANTS.CHART_WIDTH - tooltipWidth - 10))
                                                            const tooltipY = Math.max(10, labelHeight + channelIndex * rowHeight - tooltipHeight - 5)

                                                            // Update tooltip background size and position
                                                            tooltip.setAttribute('x', tooltipX.toString())
                                                            tooltip.setAttribute('y', tooltipY.toString())
                                                            tooltip.setAttribute('width', tooltipWidth.toString())
                                                            tooltip.setAttribute('height', tooltipHeight.toString())
                                                            tooltip.setAttribute('opacity', '1')

                                                            // Center text within the tooltip
                                                            tooltipText.setAttribute('x', (tooltipX + tooltipWidth / 2).toString())
                                                            tooltipText.setAttribute('y', (tooltipY + tooltipHeight / 2 + 4).toString()) // +4 to vertically center
                                                            tooltipText.setAttribute('opacity', '1')
                                                        }
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    const rect = e.currentTarget
                                                    const tooltip = rect.ownerSVGElement?.querySelector('#tooltip-bg') as SVGRectElement
                                                    const tooltipText = rect.ownerSVGElement?.querySelector('#tooltip-text') as SVGTextElement

                                                    if (tooltip && tooltipText) {
                                                        tooltip.setAttribute('opacity', '0')
                                                        tooltipText.setAttribute('opacity', '0')
                                                    }
                                                }}
                                            />
                                        )
                                    })}

                                    {/* Total count for channel - positioned to the right of heatmap */}
                                    <text
                                        x={CONSTANTS.CHART_WIDTH + 10}
                                        y={labelHeight + channelIndex * rowHeight + rowHeight / 2 + 4}
                                        textAnchor="start"
                                        className="text-xs fill-dark-400 font-medium"
                                    >
                                        {channel.totalMessages}
                                    </text>
                                </g>
                            ))}

                            {/* SVG tooltip - shows on hover */}
                            <g className="pointer-events-none">
                                <rect
                                    id="tooltip-bg"
                                    x="0"
                                    y="0"
                                    width="0"
                                    height="30"
                                    fill="#1f2937"
                                    rx="4"
                                    opacity="0"
                                    className="transition-opacity duration-200"
                                />
                                <text
                                    id="tooltip-text"
                                    x="0"
                                    y="20"
                                    textAnchor="middle"
                                    className="text-xs fill-white"
                                    opacity="0"
                                />
                            </g>
                        </svg>
                    </div>

                    {/* Load More Button */}
                    {!loading && data && filteredChannels.length > 0 && (() => {
                        // Calculate total available channels after filtering
                        let totalAvailable = showInactiveChannels
                            ? data.channels.length
                            : data.channels.filter(channel => channel.totalMessages > 0).length

                        if (channelFilter.trim()) {
                            const filtered = data.channels.filter(channel =>
                                channel.channelName.toLowerCase().includes(channelFilter.toLowerCase()) &&
                                (showInactiveChannels || channel.totalMessages > 0)
                            )
                            totalAvailable = filtered.length
                        }

                        const hasMore = channelsToShow < totalAvailable

                        return hasMore ? (
                            <div className="flex justify-center mt-6">
                                <button
                                    onClick={() => setChannelsToShow(prev => prev + 20)}
                                    className="px-4 py-2 text-sm border border-dark-600 text-dark-100 rounded-md hover:bg-dark-800 transition-colors"
                                >
                                    Load More Channels ({totalAvailable - channelsToShow} remaining)
                                </button>
                            </div>
                        ) : null
                    })()}


                    {/* Legend */}
                    <div className="flex items-center justify-between mt-4 text-xs text-dark-400">
                        <div className="flex items-center gap-2">
                            <span>Activity:</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm border border-dark-600" style={{ backgroundColor: '#1f2937' }}></div>
                                <span>Low</span>
                                <div className="w-3 h-3 rounded-sm border border-dark-600" style={{ backgroundColor: '#0d6b5a' }}></div>
                                <span>Medium</span>
                                <div className="w-3 h-3 rounded-sm border border-dark-600" style={{ backgroundColor: '#1db39c' }}></div>
                                <span>High</span>
                            </div>
                        </div>
                        <div>
                            All times shown in UTC • Showing {filteredChannels.length} channels
                        </div>
                    </div>
                </>
            )}

        </div>
    )
}

export default React.memo(MessageHeatmap); 