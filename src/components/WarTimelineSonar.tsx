'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fetcher } from '@/lib/fetcher'
import { AlertTriangle, ChevronLeft, ChevronRight, MapPin, Radio } from 'lucide-react'
import { useState } from 'react'
import useSWR from 'swr'

interface TimelineEvent {
  id: string
  timestamp: string
  headline: string
  location: string
  theater: 'ukraine-russia' | 'israel-palestine' | 'syria'
  reportId: string
  channelId: string
  channelName: string
  scheduledEvent?: string
}

const theaterConfig = {
  'ukraine-russia': {
    color: '#06b6d4',
    label: 'UKRAINE-RUSSIA',
    icon: '⚡',
    threatLevel: 'HIGH'
  },
  'israel-palestine': {
    color: '#f97316',
    label: 'ISRAEL-PALESTINE',
    icon: '⚠',
    threatLevel: 'CRITICAL'
  },
  'syria': {
    color: '#eab308',
    label: 'SYRIA',
    icon: '◆',
    threatLevel: 'ELEVATED'
  }
}

export default function WarTimelineSonar() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0] // YYYY-MM-DD
  })

  // Fetch timeline data
  const { data: timelineData, error, isLoading } = useSWR<TimelineEvent[]>(
    `/api/timeline?date=${selectedDate}`,
    fetcher,
    { revalidateOnFocus: false }
  )

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const selectedDateObj = new Date(selectedDate)
    const isSelectedDate = date.toDateString() === selectedDateObj.toDateString()

    if (isSelectedDate) {
      return 'TODAY'
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    }).toUpperCase()
  }

  const getMinutesAgo = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const minutes = Math.floor((now.getTime() - then.getTime()) / (1000 * 60))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  const navigateDate = (days: number) => {
    const currentDate = new Date(selectedDate)
    currentDate.setDate(currentDate.getDate() + days)
    setSelectedDate(currentDate.toISOString().split('T')[0])
  }

  const goToToday = () => {
    const today = new Date()
    setSelectedDate(today.toISOString().split('T')[0])
  }

  // Group by theater - only compute if we have valid array data
  const eventsByTheater = Array.isArray(timelineData)
    ? timelineData.reduce((acc, event) => {
        if (!acc[event.theater]) {
          acc[event.theater] = []
        }
        acc[event.theater].push(event)
        return acc
      }, {} as Record<string, TimelineEvent[]>)
    : {}

  // Get next 5 upcoming events (sorted chronologically)
  const upcomingEvents = Array.isArray(timelineData)
    ? [...timelineData]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(0, 5)
    : []

  return (
    <div className="w-full min-h-screen bg-slate-950 p-4 md:p-6">
      {/* Ambient glow overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/30 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto relative">
        {/* Command Header - Two Column Layout */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column - Main Header */}
          <div className="lg:col-span-2 bg-gradient-to-r from-slate-900 to-slate-800 border border-cyan-500/30 rounded-lg p-6 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-cyan-500 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500 animate-ping opacity-30" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-cyan-400 tracking-wider">SONAR TIMELINE</h1>
                  <p className="text-xs text-cyan-500/60 font-mono">CONFLICT MONITORING SYSTEM</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-cyan-400 font-mono text-sm">ACTIVE SCAN</div>
                <div className="text-cyan-500/60 text-xs font-mono">
                  {isLoading ? 'LOADING...' : `${timelineData?.length || 0} SIGNALS`}
                </div>
              </div>
            </div>

            {/* Date Navigation */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => navigateDate(-1)}
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous Day
                </Button>
                <div className="px-4 py-2 bg-slate-800 border border-cyan-500/30 rounded text-cyan-400 font-mono text-sm">
                  {new Date(selectedDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
                <Button
                  onClick={() => navigateDate(1)}
                  variant="outline"
                  size="sm"
                  className="bg-slate-800 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  disabled={selectedDate >= new Date().toISOString().split('T')[0]}
                >
                  Next Day
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <Button
                onClick={goToToday}
                variant="outline"
                size="sm"
                className="bg-cyan-500/20 border-cyan-500 text-cyan-400 hover:bg-cyan-500/30"
              >
                Today
              </Button>
            </div>

            {/* Theater status indicators */}
            <div className="flex gap-4 text-xs font-mono pt-1">
              {Object.entries(theaterConfig).map(([key, config]) => {
                const count = eventsByTheater[key]?.length || 0
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2 px-3 py-1 rounded border"
                    style={{
                      borderColor: config.color + '40',
                      backgroundColor: config.color + '10'
                    }}
                  >
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <span style={{ color: config.color }}>{config.label}</span>
                    <span className="text-white/60">({count})</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column - Upcoming Events Calendar */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-cyan-500/30 rounded-lg p-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
            <div className="mb-4">
              <h2 className="text-sm font-bold text-cyan-400 tracking-wider mb-1">NEXT EVENTS</h2>
              <p className="text-xs text-cyan-500/60 font-mono">UPCOMING SIGNALS</p>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs font-mono">
                NO UPCOMING EVENTS
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((event) => {
                  const config = theaterConfig[event.theater]
                  return (
                    <div
                      key={event.id}
                      className="p-2 rounded border-l-2 bg-slate-800/50 hover:bg-slate-800 transition-colors"
                      style={{ borderLeftColor: config.color }}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-2 h-2 rounded-full mt-1 flex-shrink-0"
                          style={{ backgroundColor: config.color }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono mb-1" style={{ color: config.color }}>
                            {formatTime(event.timestamp)}
                          </div>
                          <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                            {event.headline}
                          </p>
                          <div className="text-xs text-slate-500 mt-1 font-mono">
                            {event.location}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="inline-block w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
            <p className="mt-4 text-cyan-500 font-mono">SCANNING...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <p className="text-orange-500 font-mono">SCAN FAILED</p>
            <p className="text-slate-400 text-sm mt-2">Unable to retrieve timeline data</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && timelineData && timelineData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500 font-mono">NO SIGNALS DETECTED</p>
            <p className="text-slate-600 text-sm mt-2">No war-related events for this date</p>
          </div>
        )}

        {/* Events by theater */}
        {!isLoading && !error && timelineData && timelineData.length > 0 && (
          <div className="space-y-6">
            {Object.entries(eventsByTheater).map(([theater, events]) => {
            const config = theaterConfig[theater as keyof typeof theaterConfig]

            return (
              <div key={theater} className="space-y-3">
                {/* Theater header */}
                <div
                  className="flex items-center gap-3 px-4 py-2 rounded-lg border-l-4"
                  style={{
                    borderLeftColor: config.color,
                    backgroundColor: 'rgba(15, 23, 42, 0.8)',
                    boxShadow: `0 0 20px ${config.color}20`
                  }}
                >
                  <AlertTriangle className="h-5 w-5" style={{ color: config.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-lg" style={{ color: config.color }}>
                        {config.label}
                      </span>
                      <Badge
                        className="text-xs font-mono"
                        style={{
                          backgroundColor: config.color + '30',
                          color: config.color,
                          borderColor: config.color
                        }}
                      >
                        {config.threatLevel}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-xs text-slate-400">CONTACTS</div>
                    <div className="text-xl font-bold" style={{ color: config.color }}>
                      {events.length}
                    </div>
                  </div>
                </div>

                {/* Theater events */}
                <div className="space-y-2 pl-4">
                  {events.map((event, index) => (
                    <Card
                      key={event.id}
                      className="border bg-slate-900/50 backdrop-blur-sm transition-all duration-300 hover:translate-x-2 group relative overflow-hidden"
                      style={{ borderColor: config.color + '30' }}
                    >
                      {/* Hover glow */}
                      <div
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        style={{
                          background: `linear-gradient(90deg, ${config.color}10, transparent)`
                        }}
                      />

                      <CardContent className="p-4 relative">
                        <div className="flex items-start gap-4">
                          {/* Sonar ping visualization */}
                          <div className="flex-shrink-0 pt-1">
                            <div className="relative w-8 h-8">
                              <div
                                className="absolute inset-0 rounded-full"
                                style={{ backgroundColor: config.color + '40' }}
                              />
                              <div
                                className="absolute inset-2 rounded-full animate-pulse"
                                style={{ backgroundColor: config.color }}
                              />
                              <div
                                className="absolute inset-0 rounded-full animate-ping opacity-20"
                                style={{ backgroundColor: config.color }}
                              />
                            </div>
                          </div>

                          {/* Event content */}
                          <div className="flex-1 min-w-0">
                            {/* Time and location */}
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className="text-xs font-mono border"
                                style={{ borderColor: config.color + '50', color: config.color }}
                              >
                                {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                              </Badge>
                              <Badge variant="outline" className="text-xs font-mono border-slate-700 text-slate-400">
                                <MapPin className="h-3 w-3 mr-1" />
                                {event.location}
                              </Badge>
                              <Badge variant="outline" className="text-xs font-mono border-slate-700 text-slate-500">
                                +{getMinutesAgo(event.timestamp)}
                              </Badge>
                            </div>

                            {/* Headline */}
                            <p className="text-slate-200 font-medium leading-relaxed">
                              {event.headline}
                            </p>

                            {/* Scheduled event */}
                            {event.scheduledEvent && (
                              <div
                                className="mt-3 p-2 rounded flex items-center gap-2 border"
                                style={{
                                  backgroundColor: config.color + '15',
                                  borderColor: config.color + '40'
                                }}
                              >
                                <Radio className="h-4 w-4" style={{ color: config.color }} />
                                <span className="text-sm font-mono font-semibold" style={{ color: config.color }}>
                                  ⏰ {event.scheduledEvent}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Contact ID */}
                          <div className="flex-shrink-0 text-right font-mono">
                            <div className="text-xs text-slate-500">ID</div>
                            <div
                              className="text-sm font-bold"
                              style={{ color: config.color }}
                            >
                              {theater.substring(0, 3).toUpperCase()}-{String(index + 1).padStart(2, '0')}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 bg-slate-900/80 border border-slate-700 rounded p-3 text-xs text-slate-500 font-mono">
          <div className="flex items-center justify-between">
            <span>⬢ SYSTEM OPERATIONAL</span>
            <span>⬢ AUTO-REFRESH: 00:00 UTC</span>
            <span>⬢ SECURITY: LEVEL 3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
