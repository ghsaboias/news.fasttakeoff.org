import { CacheManager } from '@/lib/cache-utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockEnv } from '../setup';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  let mockEnv: any;

  beforeEach(() => {
    // Clear request cache before each test to prevent interference
    CacheManager.clearRequestCache();

    mockEnv = createMockEnv();
    cacheManager = new CacheManager(mockEnv);
  });

  describe('get', () => {
    it('should retrieve data from KV store', async () => {
      const testData = { test: 'value' };
      mockEnv.REPORTS_CACHE.get.mockResolvedValue(testData);

      const result = await cacheManager.get('REPORTS_CACHE', 'test-key');

      expect(mockEnv.REPORTS_CACHE.get).toHaveBeenCalledWith('test-key', { type: 'json' });
      expect(result).toEqual(testData);
    });

    it('should return null when data not found', async () => {
      mockEnv.REPORTS_CACHE.get.mockResolvedValue(null);

      const result = await cacheManager.get('REPORTS_CACHE', 'missing-key');

      expect(result).toBeNull();
    });

    it('should handle undefined namespace gracefully', async () => {
      const envWithoutCache = { ...mockEnv };
      delete envWithoutCache.REPORTS_CACHE;
      const manager = new CacheManager(envWithoutCache);

      const result = await manager.get('REPORTS_CACHE', 'test-key');

      expect(result).toBeNull();
    });
  });

  describe('put', () => {
    it('should store data in KV store with TTL', async () => {
      const testData = { test: 'value' };
      const ttl = 3600;

      await cacheManager.put('REPORTS_CACHE', 'test-key', testData, ttl);

      expect(mockEnv.REPORTS_CACHE.put).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(testData),
        { expirationTtl: ttl }
      );
    });

    it('should handle undefined namespace gracefully', async () => {
      const envWithoutCache = { ...mockEnv };
      delete envWithoutCache.REPORTS_CACHE;
      const manager = new CacheManager(envWithoutCache);

      await expect(
        manager.put('REPORTS_CACHE', 'test-key', { test: 'value' }, 3600)
      ).resolves.not.toThrow();
    });
  });

  describe('batchGet', () => {
    it('should retrieve multiple keys efficiently', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = [{ data: 'value1' }, { data: 'value2' }, null];

      mockEnv.REPORTS_CACHE.get
        .mockResolvedValueOnce(values[0])
        .mockResolvedValueOnce(values[1])
        .mockResolvedValueOnce(values[2]);

      const result = await cacheManager.batchGet('REPORTS_CACHE', keys);

      expect(result.size).toBe(3);
      expect(result.get('key1')).toEqual(values[0]);
      expect(result.get('key2')).toEqual(values[1]);
      expect(result.get('key3')).toBeNull();
    });
  });

  describe('refreshInBackground', () => {
    it('should update cache with fresh data', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ fresh: 'data' });
      const putSpy = vi.spyOn(cacheManager, 'put');

      await cacheManager.refreshInBackground('test-key', 'REPORTS_CACHE', fetchFn, 3600);

      expect(fetchFn).toHaveBeenCalled();
      expect(putSpy).toHaveBeenCalledWith('REPORTS_CACHE', 'test-key', { fresh: 'data' }, 3600);
    });

    it('should handle fetch failures gracefully', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('Fetch failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

      await expect(
        cacheManager.refreshInBackground('test-key', 'REPORTS_CACHE', fetchFn, 3600)
      ).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[CacheManager] Background refresh failed for test-key:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
