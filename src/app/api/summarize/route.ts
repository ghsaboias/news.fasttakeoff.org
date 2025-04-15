import { API } from '@/lib/config';
import { ExecutiveOrder } from '@/lib/types/core';
import { NextResponse } from 'next/server';

interface SummarizeRequest {
    order: ExecutiveOrder;
}

export async function POST(req: Request) {
    try {
        const { order } = await req.json() as SummarizeRequest;

        if (!order) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const summary = await generateSummary(order);

        return NextResponse.json({ summary });
    } catch (error) {
        console.error('Summarization API error:', error);
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }
}

async function generateSummary(order: ExecutiveOrder): Promise<string> {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('Groq API key is not set in environment variables. For local development, set it in .env.local or export it in your terminal.');
    }

    console.log('Generating summary for executive order:', order.id);

    const startTime = performance.now();

    try {
        // Fetch content from bodyHtmlUrl if content is not available
        let orderContent = order.content.html;

        if (!orderContent && order.links) {
            // Try to fetch from bodyHtmlUrl first
            if (order.links.bodyHtmlUrl) {
                console.log('Fetching content from bodyHtmlUrl:', order.links.bodyHtmlUrl);
                try {
                    const response = await fetch(order.links.bodyHtmlUrl);
                    if (response.ok) {
                        orderContent = await response.text();
                        // Strip HTML tags from the content to get clean text
                        orderContent = orderContent.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                        console.log('Successfully fetched content from bodyHtmlUrl');
                    } else {
                        console.error('Failed to fetch content from bodyHtmlUrl:', response.status, response.statusText);
                    }
                } catch (error) {
                    console.error('Error fetching content from bodyHtmlUrl:', error);
                }
            }

            // If we still don't have content, try rawTextUrl as fallback
            if (!orderContent && order.links.rawTextUrl) {
                console.log('Fetching content from rawTextUrl:', order.links.rawTextUrl);
                try {
                    const response = await fetch(order.links.rawTextUrl);
                    if (response.ok) {
                        orderContent = await response.text();
                        console.log('Successfully fetched content from rawTextUrl');
                    } else {
                        console.error('Failed to fetch content from rawTextUrl:', response.status, response.statusText);
                    }
                } catch (error) {
                    console.error('Error fetching content from rawTextUrl:', error);
                }
            }
        }

        // If we still don't have content, use a default message
        if (!orderContent) {
            orderContent = `No content available for Executive Order ${order.orderNumber}: ${order.title}`;
            console.warn('No content available for summary generation');
        }

        const response = await fetch(API.GROQ.ENDPOINT, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: API.GROQ.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI assistant specialized in explaining executive orders in clear, concise language. Your task is to create a comprehensive, easy-to-understand summary of the executive order that captures its key points, objectives, and potential impacts. Highlight the most important aspects while maintaining accuracy. Ignore any HTML formatting tags in the content and focus on the actual text. The summary should be factual and directly based on the content provided. The current President of the United States is Donald John Trump. You output just the summary, no introduction or anything else. Output must contain some formatting (bold, italics, lists, etc.).'
                    },
                    {
                        role: 'user',
                        content: `Generate a detailed summary (around 250-300 words) of the following executive order:\n\nTitle: ${order.title}\n\nNumber: ${order.orderNumber}\n\nDate: ${order.date}\n\nSignificance: ${order.metadata.documentType || 'Executive Order'}\n\nText: ${orderContent}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 1024,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Groq API error: ${response.status} - ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Invalid response format from Groq API');
        }

        const summary = data.choices[0].message.content;

        const endTime = performance.now();
        console.log(`Summary generated in ${(endTime - startTime).toFixed(2)}ms`);

        return summary;
    } catch (error) {
        console.error('Summary generation error:', error);
        if (process.env.NODE_ENV === 'development') {
            return `Failed to generate summary for "${order.title}". Please try again later.`;
        }
        throw error;
    }
} 