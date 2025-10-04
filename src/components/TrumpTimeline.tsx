'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, MapPin, AlertCircle, Globe, Shield, DollarSign, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimelineEvent {
  id: string
  date: string
  headline: string
  description: string
  city: string
  channel: string
  category: 'military' | 'foreign-policy' | 'immigration' | 'economic' | 'domestic' | 'diplomatic'
  importance: 'high' | 'medium' | 'low'
}

const timelineData: TimelineEvent[] = [
  {
    id: 'ukraine-strikes-auth',
    date: '2025-09-29',
    headline: 'Trump Authorizes Long-Range Strikes Into Russia',
    description: 'President Trump authorized Ukraine to conduct long-range drone and missile strikes inside Russia. Special Envoy Keith Kellogg confirmed some strikes will need Pentagon approval. VP Vance and Secretary Rubio support Ukraine\'s ability to "hit deep" into Russia, stating "there are no such things as sanctuaries."',
    city: 'Washington',
    channel: '🔴ukraine-russia-live',
    category: 'military',
    importance: 'high'
  },
  {
    id: 'portland-ice-protests',
    date: '2025-09-29',
    headline: 'Federal Agents Confront Portland ICE Protesters',
    description: 'Federal agents arrested anti-ICE protesters outside Portland ICE detention center. Protests continued with chants of "ICE out of Portland" as federal officers cleared roadways for facility vehicles.',
    city: 'Portland',
    channel: '🟡us-politics-live',
    category: 'immigration',
    importance: 'medium'
  },
  {
    id: 'capital-gains-tax',
    date: '2025-09-28',
    headline: 'Trump Explores Eliminating Capital Gains Tax on Home Sales',
    description: 'President Trump announced he is exploring legislation to eliminate capital gains tax on home sales, describing it as "a very big positive" for American homeowners.',
    city: 'Chicago',
    channel: '🟡us-politics-live',
    category: 'economic',
    importance: 'high'
  },
  {
    id: 'oregon-national-guard',
    date: '2025-09-28',
    headline: 'Oregon Sues Over National Guard Federalization',
    description: 'Portland filed injunction against Trump administration over federalization of 200 Oregon National Guard members. Secretary of War Pete Hegseth issued 60-day deployment order. City calls deployment "baseless" as ICE protests remain small.',
    city: 'Portland',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'high'
  },
  {
    id: 'gaza-plan-test',
    date: '2025-09-28',
    headline: 'Israeli Official Calls Trump Gaza Plan "Test Balloons"',
    description: 'Senior Israeli official stated elements of Trump\'s Gaza peace proposals are being considered as "test balloons." Senator JD Vance reiterated Trump wants Gaza and West Bank "controlled by people who live there."',
    city: 'Jerusalem',
    channel: '🔴israel-palestine-live',
    category: 'foreign-policy',
    importance: 'high'
  },
  {
    id: 'pakistan-meeting',
    date: '2025-09-28',
    headline: 'Trump Meets Pakistani Leadership at White House',
    description: 'President Trump, VP Vance, and Secretary Rubio met with Pakistan PM Shehbaz Sharif and Field Marshal Munir at White House. Meeting focused on bilateral relations and regional security.',
    city: 'Washington',
    channel: '🔵south-and-central-asia',
    category: 'diplomatic',
    importance: 'medium'
  },
  {
    id: 'syria-hts-warning',
    date: '2025-09-28',
    headline: 'US Warns HTS Leader Against Targeting SDF',
    description: 'US officials warned HTS leader al-Julani that US would intervene if events similar to Suweida repeated. Trump declined meeting with al-Julani in New York. US presented evidence of HTS involvement in Suweida.',
    city: 'New York',
    channel: '🟠syria',
    category: 'foreign-policy',
    importance: 'medium'
  },
  {
    id: 'supreme-court-aid',
    date: '2025-09-27',
    headline: 'Supreme Court Upholds Trump\'s Foreign Aid Cancellation',
    description: 'Supreme Court allowed Trump\'s "pocket rescission" of foreign aid, permitting the President to cancel previously approved foreign assistance funding.',
    city: 'Washington',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'high'
  },
  {
    id: 'birthright-citizenship',
    date: '2025-09-26',
    headline: 'Trump Seeks Supreme Court Review on Birthright Citizenship',
    description: 'Trump administration requested Supreme Court review of birthright citizenship executive order, challenging constitutional interpretation of 14th Amendment.',
    city: 'Washington',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'high'
  },
  {
    id: 'netanyahu-meeting',
    date: '2025-09-26',
    headline: 'Netanyahu Scheduled to Meet Trump',
    description: 'Israeli PM Netanyahu scheduled to meet President Trump at White House. UAE Foreign Minister to warn Netanyahu against West Bank annexation and highlight Trump\'s Gaza plan.',
    city: 'Washington',
    channel: '🔴israel-palestine-live',
    category: 'diplomatic',
    importance: 'high'
  },
  {
    id: 'venezuela-drone-plans',
    date: '2025-09-26',
    headline: 'US Prepares Drone Strike Plans Against Venezuela',
    description: 'Trump administration preparing drone strike contingency plans against Venezuela amidst escalating tensions. Administration vowed to "eradicate narco-terrorists" in Western Hemisphere.',
    city: 'Washington',
    channel: '🟡us-venezuela',
    category: 'military',
    importance: 'high'
  },
  {
    id: 'amelia-earhart',
    date: '2025-09-27',
    headline: 'Trump Orders Declassification of Amelia Earhart Records',
    description: 'President Trump ordered declassification of all records related to Amelia Earhart\'s disappearance, part of broader transparency initiative.',
    city: 'Washington',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'low'
  },
  {
    id: 'colombia-visa-revoked',
    date: '2025-09-27',
    headline: 'Colombian President\'s Visa Revoked',
    description: 'Colombian President Petro\'s US visa revoked after anti-Israel statements in NYC and calls to disobey Trump. Petro criticized US immigration policy in response.',
    city: 'New York',
    channel: '🟡us-politics-live',
    category: 'foreign-policy',
    importance: 'medium'
  },
  {
    id: 'fbi-agents-dismissed',
    date: '2025-09-27',
    headline: 'FBI Dismisses Agents Over 2020 Protest Actions',
    description: 'FBI dismissed multiple agents over their actions during 2020 protests, part of broader law enforcement accountability measures.',
    city: 'Washington',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'medium'
  },
  {
    id: 'us-attorney-fired',
    date: '2025-09-27',
    headline: 'US Attorney Fired for Following Court Order',
    description: 'Trump administration fired US Attorney after directing Border Patrol to follow court order, highlighting tensions between executive and judicial branches.',
    city: 'Los Angeles',
    channel: '🟡us-politics-live',
    category: 'domestic',
    importance: 'medium'
  }
]

const categoryIcons = {
  military: Shield,
  'foreign-policy': Globe,
  immigration: Users,
  economic: DollarSign,
  domestic: AlertCircle,
  diplomatic: Globe
}

const categoryColors = {
  military: 'bg-red-100 text-red-800 border-red-200',
  'foreign-policy': 'bg-blue-100 text-blue-800 border-blue-200',
  immigration: 'bg-purple-100 text-purple-800 border-purple-200',
  economic: 'bg-green-100 text-green-800 border-green-200',
  domestic: 'bg-orange-100 text-orange-800 border-orange-200',
  diplomatic: 'bg-indigo-100 text-indigo-800 border-indigo-200'
}

const importanceColors = {
  high: 'border-l-red-500',
  medium: 'border-l-yellow-500',
  low: 'border-l-gray-400'
}

export default function TrumpTimeline() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredData = selectedCategory
    ? timelineData.filter(item => item.category === selectedCategory)
    : timelineData

  const categories = Array.from(new Set(timelineData.map(item => item.category)))

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Trump Administration Timeline</CardTitle>
          <CardDescription>
            Key events and decisions from September 26-29, 2025
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Category Filter */}
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Events
            </Button>
            {categories.map(category => {
              const Icon = categoryIcons[category as keyof typeof categoryIcons]
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="flex items-center gap-1"
                >
                  <Icon className="h-3 w-3" />
                  {category.replace('-', ' ')}
                </Button>
              )
            })}
          </div>

          {/* Timeline */}
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />

            {/* Timeline items */}
            <div className="space-y-2">
              {filteredData.map((event) => {
                const Icon = categoryIcons[event.category]

                return (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Date dot */}
                    <div className="relative z-10 flex h-6 w-[4.1rem] flex-shrink-0 items-center justify-center">
                      <div className={cn(
                        'h-4 w-4 rounded-full border-2 border-white',
                        event.importance === 'high' ? 'bg-red-500' :
                        event.importance === 'medium' ? 'bg-yellow-500' :
                        'bg-gray-400'
                      )} />
                    </div>

                    {/* Content card */}
                    <Card className={cn(
                      'flex-1 border-l-4 gap-0',
                      importanceColors[event.importance]
                    )}>
                      <CardHeader className="pb-2 pl-6">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            {new Date(event.date).toLocaleDateString()}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.city}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn('text-xs', categoryColors[event.category])}
                          >
                            <Icon className="h-3 w-3 mr-1" />
                            {event.category.replace('-', ' ')}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg leading-tight">
                          {event.headline}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground mt-1 mb-2">
                          {event.channel}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 pl-6 pb-4">
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}