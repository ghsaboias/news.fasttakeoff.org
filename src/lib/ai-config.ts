import { ACTIVE_AI_PROVIDER_NAME, AI_PROVIDERS, AIProviderConfig } from '@/lib/config';

/**
 * Retrieves the configuration for a specific AI provider, or the active one by default.
 *
 * @param providerName The name (key) of the provider in AI_PROVIDERS. Defaults to the active provider.
 * @returns The configuration object for the requested provider.
 * @throws Error if the specified providerName is not found in AI_PROVIDERS.
 */
export function getAIProviderConfig(providerName: string = ACTIVE_AI_PROVIDER_NAME): AIProviderConfig {
    const config = AI_PROVIDERS[providerName];
    if (!config) {
        throw new Error(`AI provider configuration not found for "${providerName}". Check src/lib/config.ts.`);
    }
    return config;
}

/**
 * Retrieves the API key for a specific AI provider, or the active one by default.
 * It checks the Cloudflare environment object first, then process.env.
 *
 * @param env Optional Cloudflare environment object (containing secrets).
 * @param providerName The name (key) of the provider. Defaults to the active provider.
 * @returns The API key for the requested provider.
 * @throws Error if the API key environment variable is not set for the specified provider.
 */
export function getAIAPIKey(env?: { [key: string]: string | undefined }, providerName: string = ACTIVE_AI_PROVIDER_NAME): string {
    const config = getAIProviderConfig(providerName);
    const apiKeyEnvVar = config.apiKeyEnvVar;

    const apiKey = (env && env[apiKeyEnvVar]) || process.env[apiKeyEnvVar];

    if (!apiKey) {
        throw new Error(`Missing API key environment variable "${apiKeyEnvVar}" for AI provider "${providerName}". Set it in .env.local or Cloudflare environment variables.`);
    }

    return apiKey;
} 