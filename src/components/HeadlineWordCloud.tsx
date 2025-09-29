'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WordFrequency {
  text: string;
  value: number;
}

interface HeadlineData {
  wordFrequencies: WordFrequency[];
  metadata: {
    totalHeadlines: number;
    uniqueWords: number;
    dateRange: number;
    generatedAt: string;
  };
}

interface HeadlineWordCloudProps {
  days?: number;
}

export function HeadlineWordCloud({ days = 30 }: HeadlineWordCloudProps) {
  const [data, setData] = useState<HeadlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/headlines?days=${days}`);
        if (!response.ok) {
          throw new Error('Failed to fetch headline data');
        }
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [days]);

  const getWordStyle = (word: WordFrequency, maxValue: number) => {
    const normalizedSize = (word.value / maxValue) * 3 + 0.5; // Scale from 0.5 to 3.5
    const hue = Math.floor((word.value / maxValue) * 280); // Blue to purple range

    return {
      fontSize: `${normalizedSize}rem`,
      color: `hsl(${hue}, 70%, 50%)`,
      fontWeight: Math.floor((word.value / maxValue) * 400 + 300), // 300 to 700
      lineHeight: '1.2',
      margin: '0.2rem 0.4rem',
      display: 'inline-block',
      cursor: 'default',
      transition: 'all 0.2s ease',
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Headlines Word Cloud</CardTitle>
          <CardDescription>Most frequent words from recent news headlines</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Headlines Word Cloud</CardTitle>
          <CardDescription>Error loading word cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-red-500 text-center py-8">
            Error: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.wordFrequencies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Headlines Word Cloud</CardTitle>
          <CardDescription>No headline data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500 text-center py-8">
            No headlines found for the selected time period.
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxValue = data.wordFrequencies[0]?.value || 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Headlines Word Cloud</CardTitle>
        <CardDescription>
          Most frequent words from {data.metadata.totalHeadlines} headlines
          (last {data.metadata.dateRange} days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="text-center leading-relaxed p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg"
          style={{
            minHeight: '400px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          {data.wordFrequencies.map((word, index) => (
            <span
              key={`${word.text}-${index}`}
              style={getWordStyle(word, maxValue)}
              className="hover:scale-110 select-none"
              title={`${word.text} appears ${word.value} times`}
            >
              {word.text}
            </span>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-600 space-y-1">
          <div>Showing top {data.wordFrequencies.length} words</div>
          <div>Most frequent: &ldquo;{data.wordFrequencies[0]?.text}&rdquo; ({data.wordFrequencies[0]?.value} times)</div>
          <div className="text-xs text-gray-500">
            Generated: {new Date(data.metadata.generatedAt).toLocaleString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}