'use client'

import { useEffect, useMemo, useState } from 'react'

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

export default function MessageHeatmap() {
    const [data, setData] = useState<HeatmapResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    // No tooltip state needed for CSS tooltips
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

    useEffect(() => {
        const fetchHeatmapData = async () => {
            try {
                const response = await fetch('/api/messages/heatmap')
                if (!response.ok) throw new Error('Failed to fetch heatmap data')
                const heatmapData = await response.json()
                setData(heatmapData)
                setError(null) // Clear any previous errors
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error')
            } finally {
                setLoading(false)
            }
        }

        // Initial fetch
        fetchHeatmapData()

        // Set up auto-refresh interval
        const interval = setInterval(fetchHeatmapData, CONSTANTS.UPDATE_INTERVAL)

        // Cleanup interval on unmount
        return () => clearInterval(interval)
    }, [CONSTANTS.UPDATE_INTERVAL])

    const getColorIntensity = (count: number, maxCount: number): string => {
        if (count === 0) return '#f8fafc' // slate-50 for better contrast

        const intensity = Math.min(count / maxCount, 1)

        // Use a better color scale for accessibility
        if (intensity < 0.25) return '#dbeafe' // blue-100
        if (intensity < 0.5) return '#93c5fd'  // blue-300
        if (intensity < 0.75) return '#3b82f6' // blue-500
        return '#1d4ed8' // blue-700 for highest intensity
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

        // Generate time labels (show every 4 hours)
        const timeLabels = CONSTANTS.TIME_LABELS.map(hour => ({
            hour,
            label: `${formatUTCTime(hour)} UTC`,
            x: (hour / 24) * 100
        }))

        return { filteredChannels: channelsLimited, timeLabels, maxCountForScale }
    }, [data?.channels, channelFilter, showInactiveChannels, channelsToShow, CONSTANTS.TIME_LABELS])
    const rowHeight = CONSTANTS.CELL_HEIGHT
    const labelHeight = CONSTANTS.LABEL_HEIGHT
    const leftMargin = CONSTANTS.LEFT_MARGIN // Space for channel names

    return (
        <div className="w-full bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                    Sources Heatmap (Last 24 Hours)
                </h3>
                {data && (
                    <div className="text-xs text-gray-500">
                        Updated: {new Date(data.lastUpdated).toLocaleTimeString()}
                    </div>
                )}
            </div>

            {/* Filter Controls - Always visible */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        placeholder="Search channels..."
                        value={channelFilter}
                        onChange={(e) => setChannelFilter(e.target.value)}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={loading}
                    />
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={showInactiveChannels}
                        onChange={(e) => setShowInactiveChannels(e.target.checked)}
                        className="rounded"
                        disabled={loading}
                    />
                    Show inactive channels
                </label>
            </div>

            {/* Content Area */}
            {loading && (
                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Loading activity data...</div>
                </div>
            )}

            {!loading && (error || !data) && (
                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Unable to load activity data</div>
                </div>
            )}

            {!loading && data && filteredChannels.length === 0 && (
                <div className="flex items-center justify-center h-32 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">
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
                                    className="text-xs fill-gray-500"
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
                                        className="text-sm fill-gray-700"
                                    >
                                        {channel.channelName}
                                    </text>

                                    {/* Hour cells */}
                                    {channel.hourlyData.map((hourData: HourlyData, hourIndex: number) => {
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
                                                stroke="#e5e7eb"
                                                strokeWidth="0.5"
                                                className="cursor-pointer hover:stroke-gray-400"
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
                                        className="text-xs fill-gray-600 font-medium"
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
                                    className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                >
                                    Load More Channels ({totalAvailable - channelsToShow} remaining)
                                </button>
                            </div>
                        ) : null
                    })()}


                    {/* Legend */}
                    <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                            <span>Activity:</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-gray-100 border border-gray-300 rounded-sm"></div>
                                <span>Low</span>
                                <div className="w-3 h-3 bg-blue-300 border border-gray-300 rounded-sm"></div>
                                <div className="w-3 h-3 bg-blue-500 border border-gray-300 rounded-sm"></div>
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