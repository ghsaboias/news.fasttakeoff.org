import { AI_PROVIDERS, AIProviderConfig, AIProviderModel } from './config';
import { Cloudflare } from '../../worker-configuration';

/**
 * Retrieves the configuration for a specific AI provider, or the active one by default.
 *
 * @param providerName The name (key) of the provider in AI_PROVIDERS. Defaults to the active provider.
 * @returns The configuration object for the requested provider.
 * @throws Error if the specified providerName is not found in AI_PROVIDERS.
 */
export function getAIProviderConfig(modelOverrideId?: string): AIProviderConfig & { model: string } {
    const providerName = process.env.ACTIVE_AI_PROVIDER_NAME || 'openrouter';
    const provider = AI_PROVIDERS[providerName];
    if (!provider) throw new Error(`Unknown AI provider: ${providerName}`);

    let selectedModel: AIProviderModel | undefined;
    if (modelOverrideId) {
        selectedModel = provider.models.find(m => m.id === modelOverrideId);
    }
    if (!selectedModel) {
        selectedModel = provider.models[0];
    }
    return {
        ...provider,
        model: selectedModel.id,
        displayName: selectedModel.displayName,
    };
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
export function getAIAPIKey(env?: Cloudflare.Env, providerName: string = 'openrouter'): string {
    const config = getAIProviderConfig(providerName);
    const apiKeyEnvVar = config.apiKeyEnvVar;

    // Type-safe access to environment variables
    let apiKey: string | undefined;
    if (env) {
        switch (apiKeyEnvVar) {
            case 'GROQ_API_KEY':
                apiKey = env.GROQ_API_KEY;
                break;
            case 'OPENROUTER_API_KEY':
                apiKey = env.OPENROUTER_API_KEY;
                break;
            case 'PERPLEXITY_API_KEY':
                apiKey = env.PERPLEXITY_API_KEY;
                break;
            case 'OPENAI_API_KEY':
                apiKey = env.OPENAI_API_KEY;
                break;
            case 'GEMINI_API_KEY':
                apiKey = env.GEMINI_API_KEY;
                break;
        }
    }
    
    // Fallback to process.env if not found in Cloudflare env
    apiKey = apiKey || process.env[apiKeyEnvVar];

    if (!apiKey) {
        throw new Error(`Missing API key environment variable "${apiKeyEnvVar}" for AI provider "${providerName}". Set it in .env.local or Cloudflare environment variables.`);
    }

    return apiKey;
} 