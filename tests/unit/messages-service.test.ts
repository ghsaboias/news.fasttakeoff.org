import { MessagesService } from '@/lib/data/messages-service';
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
    messagesService = new MessagesService(mockEnv);
    mockFetch = global.fetch as Mock;
  });

  // Mock the ChannelsService dependency
  vi.mock('@/lib/data/channels-service', () => ({
    ChannelsService: vi.fn().mockImplementation(() => ({
      getChannels: vi.fn().mockResolvedValue([]),
    })),
    getChannelName: vi.fn().mockResolvedValue('🔵test-channel'),
  }));

  describe('constructor', () => {
    it('should throw error when MESSAGES_CACHE is missing', () => {
      const envWithoutCache = { ...mockEnv };
      delete envWithoutCache.MESSAGES_CACHE;

      expect(() => new MessagesService(envWithoutCache)).toThrow('Missing required KV namespace: MESSAGES_CACHE');
    });
  });

  describe('messageFilter', () => {
    it('should filter messages by bot correctly', () => {
      const mockMessages = testData.messages;
      const nonBotMessage = {
        ...mockMessages[0],
        author: { ...mockMessages[0].author, username: 'NotBot' }
      };

      const result = messagesService['messageFilter'].byBot([
        mockMessages[0],
        nonBotMessage,
        mockMessages[1]
      ] as any);

      expect(result).toHaveLength(2);
      expect(result.every(msg =>
        msg.author.username === 'FaytuksBot' &&
        msg.author.discriminator === '7032'
      )).toBe(true);
    });

    it('should filter messages by time correctly', () => {
      // Create test messages with known time relationships
      const baseTime = new Date();
      const { oldMessage, recentMessage } = createMessagesWithTimeRelation(baseTime);
      const cutoffTime = new Date(baseTime.getTime() - 60 * 60 * 1000); // 1 hour ago

      const result = messagesService['messageFilter'].byTime([oldMessage, recentMessage] as any, cutoffTime);

      // Only the recent message should pass (old message is 90 minutes ago, cutoff is 60 minutes ago)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(recentMessage.id);
    });

    it('should filter messages by IDs correctly', () => {
      const mockMessages = testData.messages;
      const targetIds = [mockMessages[0].id];

      const result = messagesService['messageFilter'].byIds(mockMessages as any, targetIds);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockMessages[0].id);
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
      const service = new MessagesService(envWithoutToken);

      await expect(service.fetchBotMessagesFromAPI('channel-id'))
        .rejects.toThrow('DISCORD_TOKEN is not set');
    });
  });

  describe('getMessagesInTimeWindow', () => {
    it('should return messages within time window from cache', async () => {
      const channelId = testData.channels[0].id;
      const cachedData = {
        messages: testData.messages,
        cachedAt: new Date().toISOString(),
        messageCount: testData.messages.length,
        lastMessageTimestamp: testData.messages[0].timestamp,
        channelName: testData.channels[0].name,
      };

      mockEnv.MESSAGES_CACHE.get.mockResolvedValue(cachedData);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = await messagesService.getMessagesInTimeWindow(channelId, twoHoursAgo, now);

      expect(result).toHaveLength(2); // Both messages are within 2 hours
      expect(result[0].timestamp).toBe(testData.messages[1].timestamp); // Sorted newest first
    });

    it('should return empty array when no cached messages', async () => {
      mockEnv.MESSAGES_CACHE.get.mockResolvedValue(null);

      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const result = await messagesService.getMessagesInTimeWindow('channel-id', twoHoursAgo, now);

      expect(result).toEqual([]);
    });
  });

  describe('cacheMessages', () => {
    it('should cache messages with proper structure', async () => {
      const channelId = testData.channels[0].id;
      const messages = testData.messages as any;

      await messagesService.cacheMessages(channelId, messages, 'test-channel');

      const putCall = mockEnv.MESSAGES_CACHE.put.mock.calls[0];
      expect(putCall[0]).toBe(`messages:${channelId}`);

      const cachedData = JSON.parse(putCall[1]);
      expect(cachedData.messages).toEqual(messages);
      expect(cachedData.messageCount).toBe(messages.length);
      expect(cachedData.channelName).toBe('test-channel');
      expect(typeof cachedData.cachedAt).toBe('string');

      expect(putCall[2]).toEqual({ expirationTtl: expect.any(Number) });
    });

    it('should handle missing KV namespace gracefully', async () => {
      const envWithoutCache = { ...mockEnv };
      delete envWithoutCache.MESSAGES_CACHE;

      expect(() => new MessagesService(envWithoutCache))
        .toThrow('Missing required KV namespace: MESSAGES_CACHE');
    });
  });
});
