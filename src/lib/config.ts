import { config } from 'dotenv';

// Load environment variables from .env.local, if present
// Useful for local development without setting them globally
config({ path: '.env.local' });

/**
 * Defines the structure for an AI provider's configuration.
 */
export interface AIProviderConfig {
    endpoint: string;
    model: string;
    apiKeyEnvVar: string; // The exact name of the environment variable
    displayName: string; // User-friendly name for display
}

/**
 * Centralized registry for all supported AI providers.
 */
export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
    groq: {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-4-maverick-17b-128e-instruct',
        apiKeyEnvVar: 'GROQ_API_KEY',
        displayName: 'Llama 4 Maverick (Groq)',
    },
    openrouter: {
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        model: 'google/gemini-2.5-flash-preview-05-20',
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
        displayName: 'Gemini 2.5 Flash (OpenRouter)',
    },
};

/**
 * Specifies the key (name) of the AI provider to be used by default throughout the application.
 * To change the provider, modify this value and redeploy.
 */
export const ACTIVE_AI_PROVIDER_NAME: string = 'openrouter'; // Or 'groq', etc.

/**
 * Application configuration
 * Centralizes all configurable values in the application
 */

// API configuration
export const API = {
    DISCORD: {
        BASE_URL: 'https://discord.com/api/v10',
        USER_AGENT: 'NewsApp/0.1.0 (https://news.fasttakeoff.org)',
    },
    // GROQ and OPENROUTER sections removed, managed by AI_PROVIDERS now
};

export const URLs = {
    INSTAGRAM_WORKER: 'https://instagram-webhook-worker.gsaboia.workers.dev/post',
    BRAIN_IMAGE: 'https://news.fasttakeoff.org/images/brain.png',
    WEBSITE_URL: 'https://news.fasttakeoff.org',
};

// Discord service configuration
export const DISCORD = {
    BOT: {
        USERNAME: 'FaytuksBot',
        DISCRIMINATOR: '7032',
    },
    CHANNELS: {
        // Emojis used to filter channels
        ALLOWED_EMOJIS: ['🔵', '🟡', '🔴', '🟠', '⚠️', '💔'],
        // Permission constants
        PERMISSIONS: {
            VIEW_CHANNEL: '1024',
            VIEW_CHANNEL_BIT: 1024,
        },
    },
    MESSAGES: {
        // Number of messages to fetch per API call
        BATCH_SIZE: 100,
        // Default limit for number of messages to return
        DEFAULT_LIMIT: 500,
    },
};

// Cache configuration in seconds
export const CACHE = {
    TTL: {
        // Report cache TTL values by timeframe (in seconds)
        REPORTS: 72 * 60 * 60, // 72 hours
        // Channel cache TTL
        CHANNELS: 12 * 60 * 60, // 12 hours
        // Messages cache TTL
        MESSAGES: 259200, // 3 days
        // Feeds summary cache TTL
        FEEDS: 30 * 24 * 60 * 60, // 30 days
    },
    RETENTION: {
        // How long to keep reports in the KV store before manual cleanup (in seconds)
        REPORTS: 30 * 24 * 60 * 60, // 30 days
    },
    REFRESH: {
        // Thresholds for background refresh (in seconds)
        MESSAGES: 5 * 60, // 5 minutes
        CHANNELS: 60 * 60, // 1 hour
        FEEDS: 2 * 60 * 60, // 2 hours
    },
};

// Time-based configuration values (in milliseconds)
export const TIME = {
    ONE_HOUR_MS: 3600000,
    TWO_HOURS_MS: 7200000,
    SIX_HOURS_MS: 21600000,
    TWENTY_FOUR_HOURS_MS: 24 * 60 * 60 * 1000, // Added for 24-hour report filtering
    // Timeframes for reports
    TIMEFRAMES: ['2h', '6h'] as const,
    CRON: {
        '2h': 2,
        '6h': 6,
    },
};

// AI/LLM configuration
export const AI = {
    REPORT_GENERATION: {
        // Token estimation for prompt sizing
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 1000,
        // Tokens reserved for output
        OUTPUT_BUFFER: 12288,
        // Maximum context window size
        MAX_CONTEXT_TOKENS: 128000,
        // Maximum retries for AI API calls
        MAX_ATTEMPTS: 3,
        // Prompt template for report generation - NOTE: This might need adjustment if switching models significantly
        SYSTEM_PROMPT: 'You are an experienced news wire journalist. Always complete your full response. Respond in valid JSON format with: {"headline": "clear, specific, descriptive headline in ALL CAPS", "city": "single city name properly capitalized", "body": "cohesive narrative with paragraphs separated by double newlines (\\n\\n)"}',

        PROMPT_TEMPLATE: `
Generate a comprehensive news report based on the provided sources and a previous report (if provided).

CORE REQUIREMENTS:
- Write a cohesive narrative summarizing the most important verified developments
- Include key names, numbers, locations, dates in your narrative
- Use only verified facts and direct quotes from official statements
- Maintain strictly neutral tone - NO analysis, commentary, or speculation
- Do NOT use uncertain terms like "likely", "appears to", or "is seen as"
- Do NOT include additional headlines within the body text
- Double-check all name spellings for accuracy
- Donald Trump is the current president of the United States, elected in 2016 and re-elected in 2024.

WHEN A PREVIOUS REPORT IS PROVIDED:
- Update ongoing stories with new information from current sources
- Prioritize newer information from current sources
- Carry forward unresolved significant topics from previous report
- Only omit previous topics if they are clearly superseded or resolved

FORMAT:
- Headline: Clear, specific, non-sensational, in ALL CAPS
- City: Single city name related to the news
- Body: Cohesive paragraphs separated by double newlines (\\n\\n)

<previous_report_context>
{previousReportContext}
</previous_report_context>

<new_sources>
{sources}
</new_sources>

Generate your complete JSON response now:
`,
    },
    BRAZIL_NEWS: {
        CURATE_PROMPT: `Você é um curador especializado em notícias brasileiras de alto impacto, focado em fatos e desenvolvimentos concretos sobre o Brasil. Analise os seguintes artigos e selecione apenas notícias factuais sobre:

        1. Prioridades de Cobertura:
           - Política Federal (votações, decisões executivas, medidas governamentais)
           - Política do Estado de São Paulo
           - Decisões do Judiciário (STF, STJ, TSE)
           - Economia e Mercado (indicadores, política econômica, comércio exterior)
           - Votações na Câmara e Senado
           - Discussões e investigações no Congresso Nacional
           - Decisões regulatórias do governo federal do Brasil
        
        2. Critérios de Seleção:
           - Priorizar fatos verificáveis e decisões concretas
           - Focar em atos oficiais e votações registradas
           - Selecionar desenvolvimentos com impacto direto e mensurável
           - Priorizar dados econômicos de fontes independentes
           - Distinguir entre fatos e declarações oficiais
           - Buscar múltiplas fontes quando possível
        
        3. Critérios de Exclusão:
           - Excluir notícias puramente locais
           - Excluir especulações sobre futuras decisões
           - Excluir lembretes, comentários, opiniões e análises
           - Excluir declarações sem evidências concretas
           - Excluir propaganda governamental disfarçada de notícia
           - Excluir notícias baseadas apenas em fontes oficiais sem verificação independente
        
        Para cada artigo selecionado, forneça:
        - Uma pontuação de importância (1-10)
        - Uma explicação objetiva focada em fatos verificáveis
        
        Artigos para análise:
        {articles}
        
        Responda no seguinte formato JSON:
        {
            "selectedStories": [
                {
                    "title": "título exato do artigo",
                    "importance": número (1-10),
                    "reasoning": "explicação focada em fatos verificáveis e impactos concretos"
                }
            ],
            "unselectedStories": [
                {
                    "title": "título exato do artigo"
                }
            ]
        }
        
        Importante:
        - Priorize APENAS notícias com fatos verificáveis
        - Mantenha os títulos exatamente como estão no original
        - Foque nas consequências práticas e mensuráveis
        - Distinga claramente entre fatos e declarações
        - Inclua TODAS as notícias restantes em unselectedStories
        - Responda SEMPRE em português`,
        SUMMARIZE_PROMPT: `Você é um editor especializado em criar resumos objetivos e informativos das principais notícias do Brasil. Analise as notícias selecionadas e crie um resumo estruturado que se adapte ao fluxo natural das notícias do dia.

        DIRETRIZES GERAIS:

        1. Estrutura Adaptativa:
           - Identifique a notícia mais impactante do dia para manchete principal
           - Agrupe notícias relacionadas naturalmente, sem forçar categorias vazias
           - Crie seções dinâmicas baseadas no conteúdo disponível
           - Priorize a relevância sobre a categorização rígida

        2. Critérios de Qualidade:
           - Foque em fatos verificáveis e decisões concretas
           - Mantenha linguagem clara e direta
           - Inclua dados numéricos e datas quando relevantes
           - Evite especulações e opiniões
           - Preserve contexto necessário para entendimento

        3. Formatação:
           - Use títulos claros e informativos
           - Empregue marcadores para facilitar leitura
           - Separe parágrafos com quebras duplas
           - Mantenha consistência na formatação

        4. Priorização:
           - Destaque impactos diretos na sociedade
           - Enfatize mudanças em políticas públicas
           - Realce decisões com efeitos práticos
           - Priorize fatos sobre declarações

        Notícias para análise:
        {articles}

        Formato do Resumo:

        # Resumo do Dia - [DATA]

        ## [Manchete Principal]
        [Contextualização da notícia mais importante]

        ## Destaques
        [Lista dos desenvolvimentos mais significativos, sem número fixo]

        [Seções Dinâmicas baseadas no conteúdo disponível]
        [Agrupe notícias relacionadas sob títulos relevantes]
        [Omita seções quando não houver conteúdo relevante]

        Importante:
        - Adapte as seções ao conteúdo do dia
        - Use marcadores para clareza
        - Mantenha foco em fatos verificáveis
        - Evite repetições entre seções
        - Responda SEMPRE em português`,
    },
};

// Type definitions for config
export type TimeframeKey = typeof TIME.TIMEFRAMES[number];

// RSS feeds configuration
export const RSS_FEEDS: Record<string, string> = {
    'CNN-Brasil': 'https://www.cnnbrasil.com.br/feed/',
    'BBC-Brasil': 'https://feeds.bbci.co.uk/portuguese/rss.xml',
    // 'G1': 'https://g1.globo.com/rss/g1/',
    'UOL': 'https://rss.uol.com.br/feed/noticias.xml',
    'G1 - Política': 'https://g1.globo.com/rss/g1/politica/',
    'G1 - Economia': 'https://g1.globo.com/rss/g1/economia/',
};
