"use client";
import { URLs } from '@/lib/config';
import type { ImageResponse } from '@/lib/types/external-apis';
import type { Report } from '@/lib/types/reports';
import Image from 'next/image';
import { useMemo, useState } from 'react';

type Props = {
  report: Report;
};

interface GeneratedImage {
  url: string;
  prompt: string;
}

function getParagraphs(body: string): string[] {
  return body.split('\n\n').map(p => p.trim()).filter(Boolean);
}

// Generate prompts for each slide based on report content
function generateSlidePrompts(report: Report): string[] {
  const paragraphs = getParagraphs(report.body);

  return [
    // Hero slide - general scene
    `Create a professional news background inspired by "${report.headline}" set in ${report.city}. Cinematic lighting, documentary photography style, dramatic scene with NO TEXT or words of any kind.`,

    // Lead slide - specific to first paragraph
    `Visual representation of "${paragraphs[0] || report.headline}" in ${report.city}. Photojournalistic style, clean composition with NO TEXT or words.`,

    // Details slide - broader context
    `News scene representing the context of "${report.headline}" in ${report.city}. Professional documentary style with atmospheric lighting, NO TEXT.`,

    // CTA slide - clean professional background
    `Clean, professional news background suitable for text overlay. Set in ${report.city}, minimalist documentary style, neutral colors, NO TEXT or graphics.`
  ];
}

export default function CarouselPreviewWithImages({ report }: Props) {
  const [index, setIndex] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paragraphs = useMemo(() => getParagraphs(report.body), [report.body]);
  const lead = paragraphs[0] || '';
  const support = paragraphs[1] || paragraphs[0] || '';
  const readMoreUrl = `${URLs.WEBSITE_URL}/current-events/${report.channelId}/${report.reportId}`;

  const slidePrompts = useMemo(() => generateSlidePrompts(report), [report]);

  // Generate images using the existing API
  const generateImages = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const images: GeneratedImage[] = [];

      for (let i = 0; i < slidePrompts.length; i++) {
        const prompt = slidePrompts[i];
        console.log(`Generating image ${i + 1}/4:`, prompt);

        const response = await fetch('/api/images/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            headline: report.headline,
            city: report.city,
            customPrompt: prompt
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate image ${i + 1}: ${response.status}`);
        }

        const result = await response.json() as ImageResponse;
        if (result.imageUrl) {
          images.push({
            url: result.imageUrl,
            prompt: prompt
          });
        }
      }

      setGeneratedImages(images);
    } catch (err) {
      console.error('Image generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate images');
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
            {generatedImages[0] ? (
              <Image src={generatedImages[0].url} alt="Generated background" fill className="object-cover" />
            ) : (
              <Image src={URLs.BRAIN_IMAGE} alt="Default background" fill className="object-cover" />
            )}
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
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md">
            {generatedImages[1] ? (
              <>
                <Image src={generatedImages[1].url} alt="Generated background" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/50" />
              </>
            ) : (
              <div className="absolute inset-0 bg-black" />
            )}
            <div className="absolute inset-0 text-white p-16 flex flex-col">
              <div className="text-sm opacity-70">Lead</div>
              <h2 className="mt-6 text-4xl font-semibold">{report.city}</h2>
              <p className="mt-8 text-3xl leading-[1.4] whitespace-pre-wrap">{lead}</p>
            </div>
          </div>
        )
      },
      {
        key: 'support',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md">
            {generatedImages[2] ? (
              <>
                <Image src={generatedImages[2].url} alt="Generated background" fill className="object-cover" />
                <div className="absolute inset-0 bg-black/60" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[#0a0a0a]" />
            )}
            <div className="absolute inset-0 text-white p-16 flex flex-col">
              <div className="text-sm opacity-70">Details</div>
              <h2 className="mt-6 text-4xl font-semibold">What we know</h2>
              <p className="mt-8 text-3xl leading-[1.4] whitespace-pre-wrap">{support}</p>
            </div>
          </div>
        )
      },
      {
        key: 'cta',
        content: (
          <div className="w-[1080px] h-[1080px] relative overflow-hidden rounded-md">
            {generatedImages[3] ? (
              <>
                <Image src={generatedImages[3].url} alt="Generated background" fill className="object-cover" />
                <div className="absolute inset-0 bg-white/85" />
              </>
            ) : (
              <div className="absolute inset-0 bg-white" />
            )}
            <div className="absolute inset-0 text-[#111] p-16 flex flex-col items-center justify-center">
              <div className="text-[#555]">Read more</div>
              <h2 className="mt-4 text-5xl font-bold text-center max-w-[800px]">{report.headline}</h2>
              <a className="mt-10 text-2xl underline text-blue-600 break-all text-center" href={readMoreUrl} target="_blank" rel="noreferrer">
                {readMoreUrl}
              </a>
            </div>
          </div>
        )
      }
    ];
  }, [lead, support, readMoreUrl, report.headline, report.city, generatedImages]);

  const total = slides.length;
  const goPrev = () => setIndex(i => (i - 1 + total) % total);
  const goNext = () => setIndex(i => (i + 1) % total);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">{report.channelName} • {new Date(report.generatedAt).toLocaleString()}</div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateImages}
            disabled={isGenerating}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {isGenerating ? 'Generating...' : 'Generate Images'}
          </button>
          <button className="px-3 py-2 border rounded" onClick={goPrev}>Prev</button>
          <div className="text-sm">{index + 1}/{total}</div>
          <button className="px-3 py-2 border rounded" onClick={goNext}>Next</button>
        </div>
      </div>

      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
          Error: {error}
        </div>
      )}

      <div className="w-[1080px]">
        {slides[index].content}
      </div>

      <div className="text-sm text-gray-500">
        {generatedImages.length > 0 ? (
          <>Preview with AI-generated backgrounds. {generatedImages.length}/4 images generated.</>
        ) : (
          <>Preview with default backgrounds. Click &quot;Generate Images&quot; to create AI backgrounds.</>
        )}
      </div>

      {generatedImages.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-gray-600">View generation prompts</summary>
          <div className="mt-2 space-y-2">
            {generatedImages.map((img, idx) => (
              <div key={idx} className="bg-gray-50 p-2 rounded">
                <strong>Slide {idx + 1}:</strong> {img.prompt}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}