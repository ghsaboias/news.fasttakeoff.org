import { MessagesService } from '@/lib/data/messages-service';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import { MessageFilterService } from '@/lib/utils/message-filter-service';
import { MessageTransformer } from '@/lib/utils/message-transformer';
import type { DiscordMessage } from '@/lib/types/discord';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { createMessagesWithTimeRelation, createTestData } from '../fixtures/testDataFactory';
import { createMockEnv } from '../setup';

describe('MessagesService', () => {
  let messagesService: MessagesService;
  let mockEnv: any;
  let mockFetch: Mock;
  let testData: ReturnType<typeof createTestData>;

  beforeEach(() => {
    // Create fresh test data for each test to ensure current timestamps
    testData = createTestData();
    mockEnv = createMockEnv();
    
    // Reset ServiceFactory singleton to ensure test isolation
    ServiceFactory.reset();
    
    const factory = ServiceFactory.getInstance(mockEnv);
    messagesService = factory.getMessagesService();
    mockFetch = global.fetch as Mock;
  });

  // Mock the ChannelsService dependency
  vi.mock('@/lib/data/channels-service', () => ({
    ChannelsService: vi.fn().mockImplementation(() => ({
      getChannels: vi.fn().mockResolvedValue([]),
    })),
    getChannelName: vi.fn().mockResolvedValue('🔵test-channel'),
  }));

  describe('messageFilter', () => {
    it('should filter messages by bot correctly', () => {
      const transformer = new MessageTransformer();
      const essentials = testData.messages
        .map(msg => transformer.transform(msg as DiscordMessage))
        .filter(result => result.success)
        .map(result => result.transformed!);

      const nonBotMessage = {
        ...essentials[0],
        author_username: 'NotBot',
      };

      const result = MessageFilterService.byBot([
        essentials[0],
        nonBotMessage,
        essentials[1]
      ]);

      expect(result).toHaveLength(2);
      expect(result.every(msg =>
        msg.author_username === 'FaytuksBot' &&
        msg.author_discriminator === '7032'
      )).toBe(true);
    });

    it('should filter messages by time correctly', () => {
      // Create test messages with known time relationships
      const baseTime = new Date();
      const { oldMessage, recentMessage } = createMessagesWithTimeRelation(baseTime);
      const cutoffTime = new Date(baseTime.getTime() - 60 * 60 * 1000); // 1 hour ago

      const transformer = new MessageTransformer();
      const essentials = [oldMessage, recentMessage]
        .map(msg => transformer.transform(msg as DiscordMessage))
        .filter(result => result.success)
        .map(result => result.transformed!);

      const result = MessageFilterService.byTimeAfter(essentials, cutoffTime);

      // Only the recent message should pass (old message is 90 minutes ago, cutoff is 60 minutes ago)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(essentials[1].id);
    });

    it('should filter messages by IDs correctly', () => {
      const transformer = new MessageTransformer();
      const essentials = testData.messages
        .map(msg => transformer.transform(msg as DiscordMessage))
        .filter(result => result.success)
        .map(result => result.transformed!);

      const targetIds = [essentials[0].id];

      const result = MessageFilterService.byIds(essentials, targetIds);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(essentials[0].id);
    });
  });

  describe('fetchBotMessagesFromAPI', () => {
    it('should fetch and filter bot messages correctly', async () => {
      const channelId = testData.channels[0].id;
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testData.messages),
        text: () => Promise.resolve(''),
      });

      const result = await messagesService.fetchBotMessagesFromAPI(channelId);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/channels/${channelId}/messages`),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: mockEnv.DISCORD_TOKEN,
          }),
        })
      );
      expect(result).toHaveLength(2);
    });

    it('should handle rate limiting', async () => {
      const channelId = testData.channels[0].id;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      await expect(messagesService.fetchBotMessagesFromAPI(channelId))
        .rejects.toThrow('Rate limited');
    });

    it('should handle API errors', async () => {
      const channelId = testData.channels[0].id;
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(messagesService.fetchBotMessagesFromAPI(channelId))
        .rejects.toThrow('Discord API error: 403');
    });

    it('should handle missing token', async () => {
      const envWithoutToken = { ...mockEnv };
      delete envWithoutToken.DISCORD_TOKEN;
      
      // Reset factory to ensure we use the new environment
      ServiceFactory.reset();
      const factory = ServiceFactory.getInstance(envWithoutToken);
      const service = factory.getMessagesService();

      await expect(service.fetchBotMessagesFromAPI('channel-id'))
        .rejects.toThrow('DISCORD_TOKEN is not set');
    });
  });

  describe('getMessagesInTimeWindow', () => {
    it('should return messages within time window from cache', async () => {
      const channelId = testData.channels[0].id;
      const d1Spy = vi
        .spyOn(messagesService['d1Service'], 'getMessagesInTimeWindow')
        .mockResolvedValue(testData.messages as any);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = await messagesService.getMessagesInTimeWindow(channelId, twoHoursAgo, now);

      expect(result).toEqual(testData.messages);
      expect(d1Spy).toHaveBeenCalledWith(channelId, twoHoursAgo, now);

      d1Spy.mockRestore();
    });

    it('should return empty array when no cached messages', async () => {
      const d1Spy = vi
        .spyOn(messagesService['d1Service'], 'getMessagesInTimeWindow')
        .mockResolvedValue([]);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = await messagesService.getMessagesInTimeWindow('channel-id', twoHoursAgo, now);

      expect(result).toEqual([]);
      expect(d1Spy).toHaveBeenCalled();

      d1Spy.mockRestore();
    });
  });

  describe('cacheMessages', () => {
    it('should persist messages to D1 without writing to KV', async () => {
      const channelId = testData.channels[0].id;
      const transformer = new MessageTransformer();
      const essentials = testData.messages
        .map(msg => transformer.transform(msg as DiscordMessage))
        .filter(result => result.success)
        .map(result => result.transformed!);

      const writeSpy = vi.spyOn(messagesService as any, 'writeToD1').mockResolvedValue(undefined);

      await messagesService.cacheMessages(channelId, essentials);

      expect(writeSpy).toHaveBeenCalledTimes(1);
      expect(writeSpy).toHaveBeenCalledWith(essentials, channelId);

      writeSpy.mockRestore();
    });
  });
});
