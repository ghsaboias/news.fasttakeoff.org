/**
 * Shadow Testing API
 * Compare KV vs D1 data for functionality validation
 * 
 * POST /api/test-migration/validate
 * Body: { channelId: "1326387616542756904", tests: ["reports", "newsletter", "display"] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';
import { D1MessagesService } from '@/lib/data/d1-messages-service';
import { migrationLogger } from '@/lib/utils/migration-logger';
import type { CachedMessages } from '@/lib/types/reports';
import type { EssentialDiscordMessage } from '@/lib/utils/message-transformer';

// Removed channel restrictions - all channels now supported for validation

interface ValidationTest {
  name: string;
  kvResult: unknown;
  d1Result: unknown;
  passed: boolean;
  differences: string[];
}

interface ValidationResult {
  success: boolean;
  channelId: string;
  channelName: string;
  tests: ValidationTest[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
  };
}

export async function POST(request: NextRequest) {
  return withErrorHandling(async (env) => {
    // Security: Require CRON_SECRET for validation operations
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Bearer token required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    if (token !== env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { channelId, tests = ['reports', 'newsletter', 'display', 'completeness'] } = body;

    // Validate channelId is provided
    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }

    migrationLogger.info(`Starting shadow validation for channel ${channelId}`, { tests });

    const result: ValidationResult = {
      success: false,
      channelId,
      channelName: 'Unknown Channel',
      tests: [],
      summary: { totalTests: 0, passed: 0, failed: 0 }
    };

    try {
      // 1. Fetch KV data
      const kvKey = `messages:${channelId}`;
      const kvData = await env.MESSAGES_CACHE.get(kvKey, 'json') as CachedMessages;
      
      if (!kvData) {
        throw new Error(`No KV data found for channel ${channelId}`);
      }

      // 2. Fetch D1 data
      const d1Service = new D1MessagesService(env);
      const d1Messages = await d1Service.getMessagesInTimeWindow(channelId, new Date('2020-01-01'), new Date('2030-01-01'));

      if (d1Messages.length === 0) {
        throw new Error(`No D1 data found for channel ${channelId}. Run migration first.`);
      }

      // 3. Run validation tests
      for (const testName of tests) {
        const test = await runValidationTest(testName, kvData, d1Messages);
        result.tests.push(test);
        result.summary.totalTests++;
        if (test.passed) {
          result.summary.passed++;
        } else {
          result.summary.failed++;
        }
      }

      result.success = result.summary.failed === 0;

      migrationLogger.info(`Shadow validation completed`, {
        channelId,
        totalTests: result.summary.totalTests,
        passed: result.summary.passed,
        failed: result.summary.failed
      });

      return NextResponse.json(result);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
      migrationLogger.error(`Shadow validation failed for channel ${channelId}`, { channelId }, error as Error);
      
      return NextResponse.json({
        success: false,
        channelId,
        channelName: 'Unknown Channel',
        tests: [],
        summary: { totalTests: 0, passed: 0, failed: 0 },
        error: errorMsg
      }, { status: 500 });
    }
  }, 'Shadow validation failed');
}

async function runValidationTest(
  testName: string, 
  kvData: CachedMessages, 
  d1Messages: EssentialDiscordMessage[]
): Promise<ValidationTest> {
  const differences: string[] = [];
  let kvResult: unknown = null;
  let d1Result: unknown = null;
  let passed = false;

  try {
    switch (testName) {
      case 'completeness':
        // Test: Do we have the same number of messages?
        kvResult = { messageCount: kvData.messageCount, sampleIds: kvData.messages.slice(0, 3).map(m => m.id) };
        d1Result = { messageCount: d1Messages.length, sampleIds: d1Messages.slice(0, 3).map(m => m.id) };
        
        if (kvData.messageCount !== d1Messages.length) {
          differences.push(`Message count mismatch: KV=${kvData.messageCount}, D1=${d1Messages.length}`);
        }
        
        // Check if message IDs match
        const kvIds = new Set(kvData.messages.map(m => m.id));
        const d1Ids = new Set(d1Messages.map(m => m.id));
        const missingInD1 = [...kvIds].filter(id => !d1Ids.has(id));
        const extraInD1 = [...d1Ids].filter(id => !kvIds.has(id));
        
        if (missingInD1.length > 0) differences.push(`Missing in D1: ${missingInD1.join(', ')}`);
        if (extraInD1.length > 0) differences.push(`Extra in D1: ${extraInD1.join(', ')}`);
        
        passed = differences.length === 0;
        break;

      case 'display':
        // Test: Can we display basic message info?
        const kvSample = kvData.messages[0];
        const d1Sample = d1Messages[0];
        
        kvResult = {
          id: kvSample.id,
          content: kvSample.content,
          author: kvSample.author?.username,
          timestamp: kvSample.timestamp
        };
        
        d1Result = {
          id: d1Sample.id,
          content: d1Sample.content,
          author: d1Sample.author_username,
          timestamp: d1Sample.timestamp
        };

        if (kvSample.id !== d1Sample.id) differences.push('Message ID mismatch');
        if (kvSample.content !== d1Sample.content) differences.push('Content mismatch');
        if (kvSample.author?.username !== d1Sample.author_username) differences.push('Author mismatch');
        if (kvSample.timestamp !== d1Sample.timestamp) differences.push('Timestamp mismatch');
        
        passed = differences.length === 0;
        break;

      case 'newsletter':
        // Test: Do embeds work for newsletter generation?
        const kvEmbeds = kvData.messages.filter(m => m.embeds && m.embeds.length > 0);
        const d1Embeds = d1Messages.filter(m => m.embeds && m.embeds.length > 0);
        
        kvResult = {
          messagesWithEmbeds: kvEmbeds.length,
          sampleEmbedTitles: kvEmbeds.slice(0, 3).map(m => m.embeds?.[0]?.title)
        };
        
        d1Result = {
          messagesWithEmbeds: d1Embeds.length,
          sampleEmbedTitles: d1Embeds.slice(0, 3).map(m => m.embeds?.[0]?.title)
        };

        if (kvEmbeds.length !== d1Embeds.length) {
          differences.push(`Embed count mismatch: KV=${kvEmbeds.length}, D1=${d1Embeds.length}`);
        }
        
        passed = differences.length === 0;
        break;

      case 'reports':
        // Test: Can we use messages for report generation?
        kvResult = {
          totalMessages: kvData.messages.length,
          totalContent: kvData.messages.reduce((sum, m) => sum + m.content.length, 0),
          hasReferences: kvData.messages.filter(m => m.referenced_message).length
        };
        
        d1Result = {
          totalMessages: d1Messages.length,
          totalContent: d1Messages.reduce((sum, m) => sum + m.content.length, 0),
          hasReferences: d1Messages.filter(m => m.referenced_message_content).length
        };

        passed = JSON.stringify(kvResult) === JSON.stringify(d1Result);
        if (!passed) {
          differences.push(`Report data structure differs`);
        }
        break;

      default:
        differences.push(`Unknown test: ${testName}`);
        passed = false;
    }
  } catch (error) {
    differences.push(`Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    passed = false;
  }

  return {
    name: testName,
    kvResult,
    d1Result,
    passed,
    differences
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'Shadow Testing API',
    availableTests: ['completeness', 'display', 'newsletter', 'reports'],
    usage: 'POST with { "channelId": "<channel-id>", "tests": ["reports", "newsletter"] }',
    note: 'Supports all channels. Run migration first before validation.'
  });
}