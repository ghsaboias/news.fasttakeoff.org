import { beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock Cloudflare environment
export const createMockEnv = (): any => ({
  DISCORD_TOKEN: 'mock-discord-token',
  DISCORD_GUILD_ID: 'mock-guild-id',
  GROQ_API_KEY: 'mock-groq-key',
  OPENROUTER_API_KEY: 'mock-openrouter-key',
  TWITTER_CLIENT_ID: 'mock-twitter-client-id',
  TWITTER_CLIENT_SECRET: 'mock-twitter-client-secret',
  INSTAGRAM_ACCESS_TOKEN: 'mock-instagram-token',
  INSTAGRAM_ACCOUNT_ID: 'mock-instagram-account',
  REPORTS_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  },
  CHANNELS_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  },
  FEEDS_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  },
  EXECUTIVE_ORDERS_CACHE: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  },
  AUTH_TOKENS: {
    get: vi.fn(),
    put: vi.fn(),
    list: vi.fn().mockResolvedValue({ keys: [] }),
  },
  FAST_TAKEOFF_NEWS_DB: {
    prepare: vi.fn(() => {
      const statement: any = {};
      statement.bind = vi.fn(() => statement);
      statement.run = vi.fn().mockResolvedValue({ success: true });
      statement.all = vi.fn().mockResolvedValue({ success: true, results: [] });
      statement.first = vi.fn().mockResolvedValue(null);
      return statement;
    }),
  },
});

// Mock fetch globally
global.fetch = vi.fn();

// Mock UUID for consistent test results
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123'),
}));

// Mock AI configuration
vi.mock('@/lib/ai-config', async () => {
  const actual = await vi.importActual('@/lib/ai-config');
  return {
    ...actual,
    getAIProviderConfig: vi.fn(() => ({
      endpoint: 'https://mock-ai-api.com/v1/chat/completions',
      model: 'mock-model',
      apiKeyEnvVar: 'MOCK_API_KEY',
      displayName: 'Mock AI Provider',
    })),
    getAIAPIKey: vi.fn(() => 'mock-api-key'),
  };
});

// Mock report utilities
vi.mock('@/lib/utils/report-utils', async () => {
  const actual = await vi.importActual('@/lib/utils/report-utils');
  return {
    ...actual,
    createPrompt: vi.fn(() => ({
      prompt: 'Mock prompt content',
      tokenCount: 1000,
    })),
    isReportTruncated: vi.fn(() => false),
  };
});

// Mock format time utility
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils');
  return {
    ...actual,
    formatTime: vi.fn((date) => new Date(date).toLocaleString()),
  };
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  // Reset fetch mock to return proper response structure
  (global.fetch as any).mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  });
});
