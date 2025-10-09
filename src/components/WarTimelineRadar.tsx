'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MapPin, Radio } from 'lucide-react'

interface TimelineEvent {
  id: string
  timestamp: string
  headline: string
  location: string
  theater: 'ukraine-russia' | 'israel-palestine' | 'syria'
  scheduledEvent?: string
}

const timelineData: TimelineEvent[] = [
  {
    id: '1',
    timestamp: '2025-10-09T04:05:44.418Z',
    headline: 'Israeli ministers storm Hebron mosque amid hostage talks',
    location: 'Hebron',
    theater: 'israel-palestine'
  },
  {
    id: '2',
    timestamp: '2025-10-09T03:35:52.707Z',
    headline: 'Russian forces intercept Ukrainian drones near Volgograd',
    location: 'Kamyshyn',
    theater: 'ukraine-russia'
  },
  {
    id: '3',
    timestamp: '2025-10-09T03:05:20.576Z',
    headline: 'Ukrainian drones strike Russian oil pumping station',
    location: 'Efimovka',
    theater: 'ukraine-russia'
  },
  {
    id: '4',
    timestamp: '2025-10-09T02:35:28.411Z',
    headline: 'Trump confirms hostage release expected Monday',
    location: 'Sharm El Sheikh',
    theater: 'israel-palestine',
    scheduledEvent: 'Hostage release - Monday'
  },
  {
    id: '5',
    timestamp: '2025-10-09T02:06:02.387Z',
    headline: 'Russian drone attack reported on Odessa region',
    location: 'Chornomorsk',
    theater: 'ukraine-russia'
  },
  {
    id: '6',
    timestamp: '2025-10-08T23:06:44.098Z',
    headline: 'Israel and Hamas reach ceasefire agreement',
    location: 'Sharm El Sheikh',
    theater: 'israel-palestine'
  },
  {
    id: '7',
    timestamp: '2025-10-08T21:37:26.901Z',
    headline: 'Suwayda security checkpoint attacked by Druze fighters',
    location: 'Suwayda',
    theater: 'syria'
  }
]

const theaterConfig = {
  'ukraine-russia': {
    color: '#3b82f6',
    label: 'UKR-RUS',
    code: 'SECTOR-ALPHA'
  },
  'israel-palestine': {
    color: '#ef4444',
    label: 'ISR-PAL',
    code: 'SECTOR-BRAVO'
  },
  'syria': {
    color: '#f59e0b',
    label: 'SYRIA',
    code: 'SECTOR-CHARLIE'
  }
}

export default function WarTimelineRadar() {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toISOString().split('T')[0]
  }

  const getHoursAgo = (timestamp: string) => {
    const now = new Date()
    const then = new Date(timestamp)
    const hours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60))
    return hours < 1 ? '<1' : hours.toString()
  }

  return (
    <div className="w-full min-h-screen bg-black p-6 font-mono">
      {/* CRT scanline overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,rgba(0,255,0,0.03)_0px,transparent_1px,transparent_2px,rgba(0,255,0,0.03)_3px)] opacity-30" />

      <div className="max-w-7xl mx-auto relative">
        {/* Header */}
        <div className="mb-8 border-2 border-green-500/30 bg-black p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <h1 className="text-2xl font-bold text-green-500">TACTICAL RADAR • WAR TIMELINE</h1>
            </div>
            <div className="text-green-500/70 text-sm">
              SYS STATUS: ACTIVE
            </div>
          </div>
          <div className="flex items-center gap-8 text-xs text-green-500/50">
            <span>TRACKING: {timelineData.length} EVENTS</span>
            <span>SECTORS: {Object.keys(theaterConfig).length}</span>
            <span>MODE: REAL-TIME</span>
          </div>
        </div>

        {/* Radar grid */}
        <div className="relative">
          {/* Grid background */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(34, 197, 94, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.3) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />

          {/* Events */}
          <div className="space-y-3 relative">
            {timelineData.map((event, index) => {
              const config = theaterConfig[event.theater]
              const hoursAgo = getHoursAgo(event.timestamp)

              return (
                <Card
                  key={event.id}
                  className="border-2 bg-black/80 backdrop-blur-sm transition-all duration-300 hover:scale-[1.01] relative overflow-hidden group"
                  style={{ borderColor: config.color + '40' }}
                >
                  {/* Pulse effect */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${config.color}10, transparent 70%)`
                    }}
                  />

                  <CardContent className="p-4 relative">
                    <div className="flex items-start gap-4">
                      {/* Event indicator */}
                      <div className="flex-shrink-0 pt-1">
                        <div className="relative">
                          <div
                            className="w-12 h-12 rounded-full border-2 flex items-center justify-center animate-pulse"
                            style={{ borderColor: config.color }}
                          >
                            <div
                              className="w-6 h-6 rounded-full"
                              style={{ backgroundColor: config.color }}
                            />
                          </div>
                          {/* Expanding rings */}
                          <div
                            className="absolute inset-0 rounded-full border-2 animate-ping opacity-20"
                            style={{ borderColor: config.color }}
                          />
                        </div>
                      </div>

                      {/* Event details */}
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <Badge
                            className="font-mono text-xs px-2 py-0.5 border"
                            style={{
                              backgroundColor: config.color + '20',
                              borderColor: config.color,
                              color: config.color
                            }}
                          >
                            {config.code}
                          </Badge>
                          <span className="text-green-500/70 text-xs font-mono">
                            {formatDate(event.timestamp)} • {formatTime(event.timestamp)}Z
                          </span>
                          <Badge variant="outline" className="text-xs font-mono border-green-500/30 text-green-500/70">
                            T-{hoursAgo}H
                          </Badge>
                          <Badge variant="outline" className="text-xs font-mono border-green-500/30 text-green-500/70">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.location}
                          </Badge>
                        </div>

                        {/* Headline */}
                        <p
                          className="text-base font-medium mb-2 leading-relaxed"
                          style={{ color: config.color }}
                        >
                          [{config.label}] {event.headline.toUpperCase()}
                        </p>

                        {/* Scheduled event */}
                        {event.scheduledEvent && (
                          <div
                            className="mt-3 p-2 border-l-4 flex items-center gap-2"
                            style={{
                              borderColor: config.color,
                              backgroundColor: config.color + '10'
                            }}
                          >
                            <Radio className="h-4 w-4" style={{ color: config.color }} />
                            <span className="text-sm font-mono" style={{ color: config.color }}>
                              SCHEDULED: {event.scheduledEvent.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Event number */}
                      <div className="flex-shrink-0 text-right">
                        <div className="text-xs text-green-500/50 font-mono">
                          EVENT
                        </div>
                        <div className="text-xl font-bold text-green-500 font-mono">
                          #{String(timelineData.length - index).padStart(2, '0')}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 border-2 border-green-500/30 bg-black p-3 text-xs text-green-500/50 font-mono">
          <div className="flex items-center justify-between">
            <span>SYSTEM: OPERATIONAL</span>
            <span>REFRESH: DAILY 00:00Z</span>
            <span>CLASSIFICATION: UNCLASSIFIED</span>
          </div>
        </div>
      </div>
    </div>
  )
}
