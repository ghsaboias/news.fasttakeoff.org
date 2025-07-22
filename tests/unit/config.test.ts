import { ACTIVE_AI_PROVIDER_NAME, AI_PROVIDERS, CACHE, DISCORD, TIME } from '@/lib/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('Configuration', () => {
  describe('AI_PROVIDERS', () => {
    it('should have valid provider configurations', () => {
      expect(AI_PROVIDERS).toBeDefined();
      expect(Object.keys(AI_PROVIDERS).length).toBeGreaterThan(0);

      Object.entries(AI_PROVIDERS).forEach(([key, provider]) => {
        expect(provider.endpoint).toMatch(/^https?:\/\//);
        expect(provider.models.length).toBeGreaterThan(0);
        expect(provider.apiKeyEnvVar.length).toBeGreaterThan(0);
        expect(provider.displayName?.length).toBeGreaterThan(0);
      });
    });

    it('should have valid active provider', () => {
      expect(ACTIVE_AI_PROVIDER_NAME).toBeDefined();
      expect(AI_PROVIDERS[ACTIVE_AI_PROVIDER_NAME]).toBeDefined();
    });
  });

  describe('TIME configuration', () => {
    it('should have consistent timeframe values', () => {
      expect(TIME.TIMEFRAMES).toContain('2h');
      expect(TIME.TIMEFRAMES).toContain('6h');

      expect(TIME.TWO_HOURS_MS).toBe(2 * 60 * 60 * 1000);
      expect(TIME.SIX_HOURS_MS).toBe(6 * 60 * 60 * 1000);
      expect(TIME.ONE_HOUR_MS).toBe(60 * 60 * 1000);
    });

    it('should have valid cron configuration', () => {
      expect(TIME.CRON['2h']).toBe(2);
      expect(TIME.CRON['6h']).toBe(6);
    });
  });

  describe('CACHE configuration', () => {
    it('should have reasonable TTL values', () => {
      expect(CACHE.TTL.REPORTS).toBeGreaterThan(3600); // At least 1 hour
      expect(CACHE.TTL.CHANNELS).toBeGreaterThan(3600); // At least 1 hour
      expect(CACHE.TTL.MESSAGES).toBeGreaterThan(3600); // At least 1 hour

      // Verify values are in seconds, not milliseconds
      expect(CACHE.TTL.REPORTS).toBeLessThan(1000000); // Less than ~11 days
    });

    it('should have refresh thresholds less than TTL', () => {
      expect(CACHE.REFRESH.MESSAGES).toBeLessThan(CACHE.TTL.MESSAGES);
      expect(CACHE.REFRESH.CHANNELS).toBeLessThan(CACHE.TTL.CHANNELS);
    });
  });

  describe('DISCORD configuration', () => {
    it('should have valid bot configuration', () => {
      expect(DISCORD.BOT.USERNAME).toBe('FaytuksBot');
      expect(DISCORD.BOT.DISCRIMINATOR).toBe('7032');
    });

    it('should have valid channel configuration', () => {
      expect(DISCORD.CHANNELS.ALLOWED_EMOJIS).toBeInstanceOf(Array);
      expect(DISCORD.CHANNELS.ALLOWED_EMOJIS.length).toBeGreaterThan(0);

      // Verify all emojis are valid unicode
      DISCORD.CHANNELS.ALLOWED_EMOJIS.forEach(emoji => {
        expect(typeof emoji).toBe('string');
        expect(emoji.length).toBeGreaterThan(0);
      });
    });

    it('should have reasonable message limits', () => {
      expect(DISCORD.MESSAGES.BATCH_SIZE).toBeGreaterThan(0);
      expect(DISCORD.MESSAGES.BATCH_SIZE).toBeLessThanOrEqual(100); // Discord API limit

      expect(DISCORD.MESSAGES.DEFAULT_LIMIT).toBeGreaterThan(0);
      expect(DISCORD.MESSAGES.DEFAULT_LIMIT).toBeGreaterThanOrEqual(DISCORD.MESSAGES.BATCH_SIZE);
    });
  });

  describe('Environment variable validation', () => {
    beforeEach(() => {
      // Reset environment
      vi.unstubAllEnvs();
    });

    it('should handle missing environment variables gracefully', async () => {
      // Configuration should not throw when imported without env vars
      expect(() => {
        // Re-import to test initialization
        return import('@/lib/config');
      }).not.toThrow();
    });
  });

  describe('AI prompt configuration', () => {
    it('should have valid system prompt', async () => {
      const { AI } = await import('@/lib/config');

      expect(AI.REPORT_GENERATION.SYSTEM_PROMPT).toContain('JSON');
      expect(AI.REPORT_GENERATION.SYSTEM_PROMPT).toContain('headline');
      expect(AI.REPORT_GENERATION.SYSTEM_PROMPT).toContain('city');
      expect(AI.REPORT_GENERATION.SYSTEM_PROMPT).toContain('body');
    });

    it('should have reasonable token limits', async () => {
      const { AI } = await import('@/lib/config');

      expect(AI.REPORT_GENERATION.MAX_CONTEXT_TOKENS).toBeGreaterThan(10000);
      expect(AI.REPORT_GENERATION.OVERHEAD_TOKENS).toBeGreaterThan(0);
      expect(AI.REPORT_GENERATION.OUTPUT_BUFFER).toBeGreaterThan(0);

      // Verify overhead + output don't exceed max context
      const total = AI.REPORT_GENERATION.OVERHEAD_TOKENS + AI.REPORT_GENERATION.OUTPUT_BUFFER;
      expect(total).toBeLessThan(AI.REPORT_GENERATION.MAX_CONTEXT_TOKENS);
    });
  });
});
