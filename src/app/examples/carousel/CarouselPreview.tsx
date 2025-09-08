"use client";
import { URLs } from '@/lib/config';
import type { ImageResponse, Report } from '@/lib/types/core';
import Image from 'next/image';
import { useMemo, useState } from 'react';

type Props = {
  report: Report;
};

function getParagraphs(body: string): string[] {
  return body.split('\n\n').map(p => p.trim()).filter(Boolean);
}

export default function CarouselPreview({ report }: Props) {
  const [index, setIndex] = useState(0);
  const [generatedBg, setGeneratedBg] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const paragraphs = useMemo(() => getParagraphs(report.body), [report.body]);
  const lead = paragraphs[0] || '';
  const support = paragraphs[1] || paragraphs[0] || '';
  const readMoreUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

  const generateBackground = async () => {
    setIsGenerating(true);
    try {
      // Use the existing OpenRouterImageService via the background cache utility
      const response = await fetch('/api/images/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headline: report.headline,
          city: report.city
        })
      });

      if (!response.ok) throw new Error('Failed to generate background');

      const result = await response.json() as ImageResponse;
      const { imageUrl } = result;
      if (imageUrl) {
        setGeneratedBg(imageUrl);
      } else {
        throw new Error('No image URL received from API');
      }
    } catch (error) {
      console.error('Background generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const slides = useMemo(() => {
    return [
      {
        key: 'hero',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md">
            <Image src={generatedBg || URLs.BRAIN_IMAGE} alt="bg" fill className="object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 flex items-center justify-center p-10">
              <h1 className="text-white text-center font-bold leading-tight" style={{ fontSize: 72, textShadow: '2px 2px 4px rgba(0,0,0,0.8)' }}>
                {report.headline}
              </h1>
            </div>
          </div>
        )
      },
      {
        key: 'lead',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md bg-black text-white p-16 flex flex-col">
            <div className="text-sm opacity-70">Lead</div>
            <h2 className="mt-6 text-4xl font-semibold">{report.city}</h2>
            <p className="mt-8 text-3xl leading-[1.4] whitespace-pre-wrap">{lead}</p>
          </div>
        )
      },
      {
        key: 'support',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md bg-[#0a0a0a] text-white p-16 flex flex-col">
            <div className="text-sm opacity-70">Details</div>
            <h2 className="mt-6 text-4xl font-semibold">What we know</h2>
            <p className="mt-8 text-3xl leading-[1.4] whitespace-pre-wrap">{support}</p>
          </div>
        )
      },
      {
        key: 'cta',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md bg-white text-[#111] p-16 flex flex-col items-center justify-center">
            <div className="text-[#555]">Read more</div>
            <h2 className="mt-4 text-5xl font-bold text-center max-w-[800px]">{report.headline}</h2>
            <a className="mt-10 text-2xl underline text-blue-600 break-all text-center" href={readMoreUrl} target="_blank" rel="noreferrer">
              {readMoreUrl}
            </a>
          </div>
        )
      }
    ];
  }, [lead, support, readMoreUrl, report.headline, report.city, generatedBg]);

  const total = slides.length;
  const goPrev = () => setIndex(i => (i - 1 + total) % total);
  const goNext = () => setIndex(i => (i + 1) % total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{report.channelName} • {new Date(report.generatedAt).toLocaleString()}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateBackground}
            disabled={isGenerating}
            className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate AI Background'}
          </button>
          <button className="px-3 py-2 border rounded" onClick={goPrev}>Prev</button>
          <div className="text-sm">{index + 1}/{total}</div>
          <button className="px-3 py-2 border rounded" onClick={goNext}>Next</button>
        </div>
      </div>
      <div className="w-[1080px]">
        {slides[index].content}
      </div>
      <div className="text-sm text-gray-500">
        Preview with {generatedBg ? 'AI-generated' : 'default'} background. Assets sized for 1080×1080 IG carousel.
      </div>
    </div>
  );
}

