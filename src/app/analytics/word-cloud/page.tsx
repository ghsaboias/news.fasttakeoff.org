'use client';

import { useState } from 'react';
import { HeadlineWordCloud } from '@/components/HeadlineWordCloud';
import { Button } from '@/components/ui/button';

export default function HeadlinesAnalyticsPage() {
  const [selectedDays, setSelectedDays] = useState(30);

  const timeRangeOptions = [
    { label: '7 days', value: 7 },
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Headlines Analytics</h1>
          <p className="text-gray-600">
            Explore the most frequent words and themes in news headlines
          </p>
        </div>

        <div className="flex justify-center space-x-2">
          {timeRangeOptions.map((option) => (
            <Button
              key={option.value}
              variant={selectedDays === option.value ? 'default' : 'outline'}
              onClick={() => setSelectedDays(option.value)}
              size="sm"
            >
              {option.label}
            </Button>
          ))}
        </div>

        <HeadlineWordCloud days={selectedDays} />

        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>
            Word cloud generated from headlines in the FastTakeoff news database.
          </p>
          <p>
            Size and color intensity represent word frequency.
            Common stop words are filtered out.
          </p>
        </div>
      </div>
    </div>
  );
}