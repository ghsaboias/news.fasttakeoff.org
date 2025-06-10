import { ReportGeneratorService } from '@/lib/data/report-generator-service';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestData } from '../fixtures/testDataFactory';
import { createMockEnv } from '../setup';

// Create test data
const testData = createTestData();

// Mock all service dependencies
vi.mock('@/lib/data/report-ai-service', () => ({
  ReportAIService: vi.fn().mockImplementation(() => ({
    generateReport: vi.fn().mockResolvedValue(testData.reports[0]),
  })),
}));

vi.mock('@/lib/data/report-cache-service', () => ({
  ReportCacheService: vi.fn().mockImplementation(() => ({
    getReportsFromCache: vi.fn().mockResolvedValue([testData.reports[0]]),
    cacheReport: vi.fn().mockResolvedValue(undefined),
    getRecentPreviousReports: vi.fn().mockResolvedValue([]),
    getAllReportsFromCache: vi.fn().mockResolvedValue([testData.reports[0]]),
    batchGetReports: vi.fn().mockResolvedValue(new Map()),
    cacheHomepageReports: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@/lib/data/messages-service', () => ({
  MessagesService: vi.fn().mockImplementation(() => ({
    getMessagesForTimeframe: vi.fn().mockResolvedValue(testData.messages),
    getMessagesForReport: vi.fn().mockResolvedValue(testData.messages),
    listMessageKeys: vi.fn().mockResolvedValue([
      { name: 'messages:1179003366362329138' },
      { name: 'messages:1179003366362329139' },
    ]),
  })),
}));

vi.mock('@/lib/data/channels-service', () => ({
  ChannelsService: vi.fn().mockImplementation(() => ({
    getChannelName: vi.fn().mockResolvedValue('🔵test-channel'),
    getChannels: vi.fn().mockResolvedValue(testData.channels),
  })),
}));

vi.mock('@/lib/instagram-service', () => ({
  InstagramService: vi.fn().mockImplementation(() => ({
    postNews: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('@/lib/twitter-service', () => ({
  TwitterService: vi.fn().mockImplementation(() => ({
    postTweet: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe('ReportGeneratorService', () => {
  let reportGenerator: ReportGeneratorService;
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    reportGenerator = new ReportGeneratorService(mockEnv);
  });

  describe('createReportAndGetMessages', () => {
    it('should create report when messages exist', async () => {
      const channelId = testData.channels[0].id;

      const result = await reportGenerator.createReportAndGetMessages(channelId, '2h');

      expect(result.report).toBeTruthy();
      expect(result.report?.reportId).toBe(testData.reports[0].reportId);
      expect(result.messages).toHaveLength(2);
    });

    it('should return null report when no messages', async () => {
      const mockMessagesService = reportGenerator['messagesService'];
      vi.mocked(mockMessagesService.getMessagesForTimeframe).mockResolvedValueOnce([]);

      const result = await reportGenerator.createReportAndGetMessages('channel-id', '2h');

      expect(result.report).toBeNull();
      expect(result.messages).toEqual([]);
    });

    it('should handle AI generation errors', async () => {
      const mockAIService = reportGenerator['aiService'];
      vi.mocked(mockAIService.generateReport).mockRejectedValueOnce(new Error('AI API failed'));

      await expect(
        reportGenerator.createReportAndGetMessages('channel-id', '2h')
      ).rejects.toThrow('AI API failed');
    });
  });

  describe('getLastReportAndMessages', () => {
    it('should return cached report if fresh', async () => {
      const mockCacheService = reportGenerator.cacheService;
      const freshReport = {
        ...testData.reports[0],
        generatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      };
      vi.mocked(mockCacheService.getReportsFromCache).mockResolvedValueOnce([freshReport]);

      const result = await reportGenerator.getLastReportAndMessages('channel-id', '2h');

      expect(result.report).toBeTruthy();
      expect(result.report?.cacheStatus).toBe('hit');
    });

    it('should return null for stale cached report', async () => {
      const mockCacheService = reportGenerator.cacheService;
      const staleReport = {
        ...testData.reports[0],
        generatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      };
      vi.mocked(mockCacheService.getReportsFromCache).mockResolvedValueOnce([staleReport]);

      const result = await reportGenerator.getLastReportAndMessages('channel-id', '2h');

      expect(result.report).toBeNull();
      expect(result.messages).toHaveLength(2);
    });
  });

  describe('getReportAndMessages', () => {
    it('should find and return specific report', async () => {
      const mockCacheService = reportGenerator.cacheService;
      vi.mocked(mockCacheService.getReportsFromCache).mockResolvedValueOnce([testData.reports[0]]);

      const result = await reportGenerator.getReportAndMessages(
        'channel-id',
        testData.reports[0].reportId,
        '2h'
      );

      expect(result.report).toBeTruthy();
      expect(result.report?.reportId).toBe(testData.reports[0].reportId);
    });

    it('should return null when report not found', async () => {
      const mockCacheService = reportGenerator.cacheService;
      vi.mocked(mockCacheService.getReportsFromCache).mockResolvedValueOnce([]);

      const result = await reportGenerator.getReportAndMessages(
        'channel-id',
        'missing-report-id',
        '2h'
      );

      expect(result.report).toBeNull();
      expect(result.messages).toEqual([]);
    });
  });

  describe('createFreshReports', () => {
    beforeEach(() => {
      // Mock Date to control hour-based logic
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-10T14:00:00Z')); // 14:00 UTC = 2h cron trigger
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should generate reports for active timeframes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await reportGenerator.createFreshReports();

      expect(consoleSpy).toHaveBeenCalledWith('[REPORTS] Production run starting.');
      expect(consoleSpy).toHaveBeenCalledWith('[REPORTS] Production run finished.');

      consoleSpy.mockRestore();
    });

    it('should skip when no timeframes are active', async () => {
      vi.setSystemTime(new Date('2025-06-10T13:00:00Z')); // 13:00 UTC = no active timeframes

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await reportGenerator.createFreshReports();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[REPORTS] No timeframes are active based on the current hour. Exiting.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('generateReportsForManualTrigger', () => {
    it('should process specified timeframes', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await reportGenerator.generateReportsForManualTrigger(['2h']);

      expect(consoleSpy).toHaveBeenCalledWith('[REPORTS] Manual run finished.');

      consoleSpy.mockRestore();
    });

    it('should process all timeframes when requested', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await reportGenerator.generateReportsForManualTrigger('ALL');

      expect(consoleSpy).toHaveBeenCalledWith('[REPORTS] Manual run finished.');

      consoleSpy.mockRestore();
    });

    it('should exit when no timeframes specified', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

      await reportGenerator.generateReportsForManualTrigger([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[REPORTS] No timeframes specified or resolved for manual run. Exiting.'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('social media posting', () => {
    it('should post top report to social media platforms', async () => {
      const mockInstagram = reportGenerator['instagramService'];
      const mockTwitter = reportGenerator['twitterService'];

      await reportGenerator['_postTopReportToSocialMedia']([testData.reports[0]]);

      expect(mockInstagram.postNews).toHaveBeenCalledWith(testData.reports[0]);
      expect(mockTwitter.postTweet).toHaveBeenCalledWith(testData.reports[0]);
    });

    it('should handle social media posting errors gracefully', async () => {
      const mockInstagram = reportGenerator['instagramService'];
      const mockTwitter = reportGenerator['twitterService'];
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      vi.mocked(mockInstagram.postNews).mockRejectedValueOnce(new Error('Instagram failed'));
      vi.mocked(mockTwitter.postTweet).mockRejectedValueOnce(new Error('Twitter failed'));

      await expect(
        reportGenerator['_postTopReportToSocialMedia']([testData.reports[0]])
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to post report'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should skip posting when no reports generated', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { });

      await reportGenerator['_postTopReportToSocialMedia']([]);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[REPORTS] No reports generated, skipping social media posts.'
      );

      consoleSpy.mockRestore();
    });
  });
});
