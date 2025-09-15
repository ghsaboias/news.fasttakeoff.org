/**
 * Test Migration API
 * Safely migrate single channel from KV to D1 for shadow testing
 * 
 * POST /api/test-migration/migrate
 * Body: { channelId: "1326387616542756904" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandling } from '@/lib/api-utils';
import { SingleChannelMigrator } from '@/lib/utils/single-channel-migrator';
import { migrationLogger } from '@/lib/utils/migration-logger';

// Removed channel restrictions - all channels now supported for migration

export async function POST(request: NextRequest) {
  return withErrorHandling(async (env) => {
    // Security: Require CRON_SECRET for migration operations
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
    const { channelId } = body;

    // Validate channelId is provided
    if (!channelId) {
      return NextResponse.json(
        { error: 'channelId is required' },
        { status: 400 }
      );
    }

    // Initialize migrator
    const migrator = new SingleChannelMigrator(env);

    migrationLogger.info(`Starting test migration for channel ${channelId}`);

    // Perform migration
    const result = await migrator.migrateChannel(channelId);

    migrationLogger.info(`Migration completed`, {
      channelId,
      success: result.success,
      messagesProcessed: result.messagesProcessed,
      messagesSuccessful: result.messagesSuccessful,
      duration: result.duration
    });

    return NextResponse.json({
      success: result.success,
      channelId: result.channelId,
      channelName: result.channelName,
      stats: {
        messagesProcessed: result.messagesProcessed,
        messagesSuccessful: result.messagesSuccessful,
        messagesFailed: result.messagesFailed,
        propertiesReduced: result.propertiesReduced,
        duration: result.duration
      },
      errors: result.errors,
      message: result.success 
        ? `Successfully migrated ${result.messagesSuccessful} messages to D1` 
        : `Migration failed with ${result.messagesFailed} errors`
    });
  }, 'Migration failed');
}

export async function GET() {
  return NextResponse.json({
    message: 'Channel Migration API',
    usage: 'POST with { "channelId": "<channel-id>" }',
    note: 'Supports all channels. Start with smallest channels first for safety.'
  });
}