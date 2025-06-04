import { InstagramService } from '@/lib/instagram-service';
import { Report } from '@/lib/types/core';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { Cloudflare } from '../../../../worker-configuration';

export async function GET() {
    try {
        // Create a mock report with a problematic long headline
        const mockReport: Report = {
            reportId: uuidv4(),
            headline: "Breaking: Major Economic Policy Shift Announced - Government Introduces Comprehensive Reform Package Including Tax Restructuring and Infrastructure Investment Plans",
            body: "The government today unveiled a sweeping economic reform package that aims to revitalize the nation's economy through a series of targeted measures. The announcement, made during a press conference at the National Economic Council, outlines several key initiatives including tax system restructuring, infrastructure development programs, and new investment incentives.\n\nThe reform package includes significant changes to corporate tax rates, a new framework for foreign investments, and a $500 billion infrastructure development plan spanning the next decade. Officials emphasized that these measures are designed to boost economic growth while maintaining fiscal responsibility.\n\nMarket analysts have responded positively to the announcement, with early indicators showing increased confidence in the market. However, some economists have expressed concerns about the long-term implications of certain aspects of the reform package.",
            channelId: "test-channel",
            channelName: "🌐 Economic Updates",
            city: "Washington, D.C.",
            generatedAt: new Date().toISOString(),
            messageCount: 5
        };

        // Get environment variables
        const env: Cloudflare.Env = {
            INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
        } as Cloudflare.Env;

        // Initialize Instagram service with environment
        const instagramService = new InstagramService(env);

        // Attempt to post to Instagram
        await instagramService.postNews(mockReport);

        return NextResponse.json({
            success: true,
            message: 'Successfully tested Instagram post',
            report: mockReport
        });

    } catch (error) {
        console.error('[TEST-INSTAGRAM] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        }, { status: 500 });
    }
} 