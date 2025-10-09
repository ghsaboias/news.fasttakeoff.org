'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Calendar, MapPin, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

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
    color: 'bg-blue-500',
    lightColor: 'bg-blue-400',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500',
    label: '🇺🇦 Ukraine-Russia'
  },
  'israel-palestine': {
    color: 'bg-red-500',
    lightColor: 'bg-red-400',
    textColor: 'text-red-400',
    borderColor: 'border-red-500',
    label: '🇮🇱 Israel-Palestine'
  },
  'syria': {
    color: 'bg-amber-500',
    lightColor: 'bg-amber-400',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500',
    label: '🇸🇾 Syria'
  }
}

export default function WarTimelineMetro() {
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
    const today = new Date()
    const isToday = date.toDateString() === today.toDateString()

    if (isToday) {
      return 'Today'
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Group events by theater
  const eventsByTheater = timelineData.reduce((acc, event) => {
    if (!acc[event.theater]) {
      acc[event.theater] = []
    }
    acc[event.theater].push(event)
    return acc
  }, {} as Record<string, TimelineEvent[]>)

  return (
    <div className="w-full mx-auto p-6 bg-gradient-to-br from-gray-950 via-gray-900 to-black min-h-screen">
      <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
        <CardHeader className="border-b border-gray-700 pb-4">
          <h1 className="text-3xl font-bold text-gray-100">War Timeline Metro</h1>
          <p className="text-gray-400 text-sm mt-1">Live conflict zone updates • Metro view</p>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Theater lines */}
          <div className="space-y-12">
            {Object.entries(eventsByTheater).map(([theater, events]) => {
              const config = theaterConfig[theater as keyof typeof theaterConfig]

              return (
                <div key={theater} className="relative">
                  {/* Theater label */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className={cn("w-1 h-8 rounded-full", config.color)} />
                    <h2 className={cn("text-xl font-bold", config.textColor)}>
                      {config.label}
                    </h2>
                    <div className="flex-1 h-0.5 bg-gradient-to-r from-gray-700 to-transparent" />
                  </div>

                  {/* Metro line with stations */}
                  <div className="relative pl-8">
                    {/* Vertical metro line */}
                    <div className={cn(
                      "absolute left-3 top-0 bottom-0 w-1 rounded-full",
                      config.color
                    )} />

                    {/* Stations (events) */}
                    <div className="space-y-6">
                      {events.map((event) => (
                        <div key={event.id} className="relative">
                          {/* Station dot */}
                          <div className={cn(
                            "absolute -left-[1.65rem] top-3 w-5 h-5 rounded-full border-4 border-gray-900",
                            config.lightColor,
                            "shadow-lg"
                          )} />

                          {/* Station card */}
                          <Card className={cn(
                            "ml-4 border-l-4 transition-all duration-200 hover:translate-x-1",
                            "bg-gray-800/80 border-gray-700",
                            config.borderColor
                          )}>
                            <CardContent className="p-4">
                              {/* Time and location */}
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <Badge variant="outline" className="text-xs font-mono bg-gray-900/50">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  {formatDate(event.timestamp)} {formatTime(event.timestamp)}
                                </Badge>
                                <Badge variant="outline" className="text-xs bg-gray-900/50">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {event.location}
                                </Badge>
                              </div>

                              {/* Headline */}
                              <p className="text-gray-100 font-medium leading-relaxed">
                                {event.headline}
                              </p>

                              {/* Scheduled event banner */}
                              {event.scheduledEvent && (
                                <div className={cn(
                                  "mt-3 p-2 rounded-md flex items-center gap-2",
                                  "bg-gradient-to-r from-gray-700/50 to-transparent",
                                  config.borderColor,
                                  "border-l-2"
                                )}>
                                  <Radio className={cn("h-4 w-4", config.textColor)} />
                                  <span className={cn("text-sm font-semibold", config.textColor)}>
                                    SCHEDULED: {event.scheduledEvent}
                                  </span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>
                      ))}

                      {/* End of line indicator */}
                      <div className="relative pl-4">
                        <div className={cn(
                          "absolute -left-7 w-7 h-7 rounded-full border-4 border-gray-900 flex items-center justify-center",
                          config.color
                        )}>
                          <div className="w-2 h-2 bg-gray-900 rounded-full" />
                        </div>
                        <p className="text-gray-500 text-sm italic ml-4">
                          {events.length} event{events.length !== 1 ? 's' : ''} on this line
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <p className="text-gray-500 text-xs">
              Auto-refreshes daily at midnight UTC
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
