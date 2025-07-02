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
        model: 'google/gemini-2.5-flash',
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
        ALLOWED_EMOJIS: ['🔵', '🟡', '🔴', '🟠', '⚠️', '⚫'],
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
        MESSAGES: 2592000, // 30 days
        // Feeds summary cache TTL
        FEEDS: 30 * 24 * 60 * 60, // 30 days
        // Entity extraction cache TTL
        ENTITIES: 24 * 60 * 60, // 24 hours
    },
    RETENTION: {
        // How long to keep reports in the KV store before manual cleanup (in seconds)
        REPORTS: 30 * 24 * 60 * 60, // 30 days
        // How long to keep extracted entities
        ENTITIES: 7 * 24 * 60 * 60, // 7 days
    },
    REFRESH: {
        // Thresholds for background refresh (in seconds)
        MESSAGES: 5 * 60, // 5 minutes
        CHANNELS: 60 * 60, // 1 hour
        FEEDS: 2 * 60 * 60, // 2 hours
        ENTITIES: 12 * 60 * 60, // 12 hours
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

CURRENT DATE: {currentDate}

CORE REQUIREMENTS:
- Write a cohesive narrative summarizing the most important verified developments
- Include key names, numbers, locations, dates in your narrative
- Reference timing relative to current date when relevant (e.g., "yesterday", "this morning", "last week")
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
    ENTITY_EXTRACTION: {
        // Token estimation for entity extraction prompts
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 500,
        // Tokens reserved for output
        OUTPUT_BUFFER: 4096,
        // Maximum context window for entity extraction
        MAX_CONTEXT_TOKENS: 32000,
        // Maximum retries for entity extraction API calls
        MAX_ATTEMPTS: 2,
        // System prompt for entity extraction
        SYSTEM_PROMPT: 'You are an expert entity extraction system. Extract entities from news text with high precision. Respond in valid JSON format with entity types, values, positions, and confidence scores.',

        PROMPT_TEMPLATE: `
Extract named entities from the following news text. Focus only on the most important entities for news intelligence and analysis.

ENTITY TYPES TO EXTRACT (ONLY THESE THREE):
- PERSON: Names of individuals (politicians, officials, public figures, leaders, etc.)
- ORGANIZATION: Companies, institutions, government agencies, political parties, military groups
- LOCATION: Countries, cities, states, regions, specific places, geographic areas

EXTRACTION REQUIREMENTS:
- Extract ONLY named entities that are specifically mentioned in the text
- Only extract entities that are central to the news story
- Provide confidence scores (0.0-1.0) based on contextual clarity
- Calculate relevance scores (0.0-1.0) based on importance to the story
- Include all mentions of each entity with precise text positions
- Normalize similar entities (e.g., "Trump" and "Donald Trump" as same PERSON)
- Do NOT extract generic terms, common nouns, or descriptive words
- Focus only on proper nouns that would be useful for news indexing and search

TEXT TO ANALYZE:
{text}

Extract entities and respond with the following JSON structure:
{
  "entities": [
    {
      "type": "PERSON|ORGANIZATION|LOCATION",
      "value": "normalized entity name",
      "mentions": [
        {
          "text": "exact text as it appears",
          "startIndex": number,
          "endIndex": number,
          "confidence": number
        }
      ],
      "relevanceScore": number,
      "category": "optional subcategory"
    }
  ]
}
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
    SOURCE_ATTRIBUTION: {
        // Token estimation for source attribution prompts
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 800,
        // Tokens reserved for output
        OUTPUT_BUFFER: 4096,
        // Maximum context window for source attribution
        MAX_CONTEXT_TOKENS: 32000,
        // Maximum retries for source attribution API calls
        MAX_ATTEMPTS: 3,
        // System prompt for source attribution
        SYSTEM_PROMPT: 'You are a source attribution system. Your job is to map every sentence in a news report to the specific source message it came from.\n\nREQUIREMENTS:\n1. Every sentence in the report MUST be attributed to exactly one source message\n2. Return the EXACT TEXT of each sentence as it appears in the report\n3. Map each sentence to the most relevant source message using the FULL MESSAGE_ID (the long numeric ID after "MESSAGE_ID:")\n4. Assign confidence scores (0.5-1.0) based on how clearly the sentence maps to the source\n\nCRITICAL: \n- Use the complete MESSAGE_ID (e.g., "1390020515489517570") NOT array indices or shortened forms\n- Break the report into individual sentences\n- Each sentence gets mapped to exactly ONE source message\n- Use the exact sentence text from the report\n- Aim for 100% coverage of the report text\n\nRespond with valid JSON only.',

        PROMPT_TEMPLATE: `Map every sentence in this report to its source message.

REPORT TO ANALYZE:
"""
{reportBody}
"""

SOURCE MESSAGES:
{sourceMessages}

Break the report into sentences and map each sentence to the most relevant MESSAGE_ID.

IMPORTANT: Use the full MESSAGE_ID numbers (e.g., "1390020515489517570") in sourceMessageId field.

Response format:
{
  "attributions": [
    {
      "id": "attr1", 
      "text": "exact sentence from report",
      "sourceMessageId": "1390020515489517570",
      "confidence": 0.8
    }
  ]
}`,
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

export const ERROR_NO_OPENAI_KEY = 'Missing OPENAI_API_KEY';
export const ERROR_NO_DISCORD_TOKEN = 'Missing DISCORD_BOT_TOKEN';

export const ENTITY_COLORS: { [key: string]: string } = {
    // Power network types (lowercase)
    person: '#4a90e2',   // Blue
    company: '#7ed321',  // Green
    fund: '#e67e22',     // Orange

    PERSON: '#4a90e2',
    ORGANIZATION: '#7ed321',
    LOCATION: '#e67e22',
    DEFAULT: '#888888'
};

export const ENTITY_LABELS: { [key: string]: string } = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
};
