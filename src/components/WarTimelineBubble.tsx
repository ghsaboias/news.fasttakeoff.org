'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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

const theaterColors = {
  'ukraine-russia': {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    dot: 'bg-blue-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.3)]'
  },
  'israel-palestine': {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.3)]'
  },
  'syria': {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-500',
    glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]'
  }
}

const theaterLabels = {
  'ukraine-russia': 'Ukraine-Russia',
  'israel-palestine': 'Israel-Palestine',
  'syria': 'Syria'
}

export default function WarTimelineBubble() {
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-6 bg-gradient-to-b from-gray-950 via-gray-900 to-black min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">War Timeline</h1>
        <p className="text-gray-400">Live updates from conflict zones</p>
      </div>

      {/* Floating bubble timeline */}
      <div className="relative space-y-8">
        {timelineData.map((event, index) => {
          const colors = theaterColors[event.theater]
          const isLeft = index % 2 === 0

          return (
            <div key={event.id} className={cn(
              "flex items-center gap-6",
              isLeft ? "flex-row" : "flex-row-reverse"
            )}>
              {/* Spacer for alternating layout */}
              <div className="flex-1 hidden md:block" />

              {/* Time dot connector */}
              <div className="relative flex flex-col items-center">
                <div className={cn(
                  "w-4 h-4 rounded-full border-4 border-gray-900",
                  colors.dot,
                  colors.glow,
                  "animate-pulse"
                )} />
                {index < timelineData.length - 1 && (
                  <div className={cn(
                    "w-0.5 h-20 mt-2",
                    "bg-gradient-to-b from-gray-600 to-transparent"
                  )} />
                )}
              </div>

              {/* Content bubble */}
              <div className="flex-1">
                <Card className={cn(
                  "border-2 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]",
                  colors.bg,
                  colors.border,
                  colors.glow,
                  "hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]"
                )}>
                  <CardContent className="p-4">
                    {/* Header badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge variant="outline" className={cn("text-xs", colors.text, colors.border)}>
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(event.timestamp)} • {formatTime(event.timestamp)}
                      </Badge>
                      <Badge variant="outline" className={cn("text-xs", colors.text, colors.border)}>
                        <MapPin className="h-3 w-3 mr-1" />
                        {event.location}
                      </Badge>
                      <Badge className={cn("text-xs", colors.bg, colors.text, colors.border)}>
                        {theaterLabels[event.theater]}
                      </Badge>
                    </div>

                    {/* Headline */}
                    <p className={cn("text-lg font-semibold leading-tight", colors.text)}>
                      {event.headline}
                    </p>

                    {/* Scheduled event */}
                    {event.scheduledEvent && (
                      <div className={cn(
                        "mt-3 pt-3 border-t flex items-center gap-2",
                        colors.border
                      )}>
                        <Radio className={cn("h-4 w-4", colors.text)} />
                        <span className={cn("text-sm font-medium", colors.text)}>
                          {event.scheduledEvent}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
