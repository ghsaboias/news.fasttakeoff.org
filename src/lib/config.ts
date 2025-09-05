import { config } from 'dotenv';

// Load environment variables from .env.local, if present
// Useful for local development without setting them globally
config({ path: '.env.local' });

/**
 * Defines the structure for an AI provider's configuration.
 */
export interface AIProviderModel {
    id: string;
    displayName: string;
}

export interface AIProviderConfig {
    endpoint: string;
    models: AIProviderModel[];
    apiKeyEnvVar: string;
    displayName?: string; // Optional, for legacy support
}

/**
 * Centralized registry for all supported AI providers.
 */
export const AI_PROVIDERS: Record<string, AIProviderConfig> = {
    groq: {
        endpoint: 'https://api.groq.com/openai/v1/chat/completions',
        models: [
            {
                id: 'llama-4-maverick-17b-128e-instruct',
                displayName: 'Llama 4 Maverick (Groq)',
            },
        ],
        apiKeyEnvVar: 'GROQ_API_KEY',
        displayName: 'Llama 4 Maverick (Groq)',
    },
    openrouter: {
        endpoint: 'https://openrouter.ai/api/v1/chat/completions',
        models: [
            {
                id: 'google/gemini-2.5-flash-lite',
                displayName: 'Gemini 2.5 Flash Lite (OpenRouter)',
            },
            {
                id: 'qwen/qwen3-235b-a22b',
                displayName: 'Qwen3 235B (OpenRouter)',
            },
        ],
        apiKeyEnvVar: 'OPENROUTER_API_KEY',
    },
    perplexity: {
        endpoint: 'https://api.perplexity.ai/chat/completions',
        models: [
            {
                id: 'sonar',
                displayName: 'Perplexity Sonar',
            },
        ],
        apiKeyEnvVar: 'PERPLEXITY_API_KEY',
        displayName: 'Perplexity Sonar',
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
        REPORTS: 30 * 24 * 60 * 60, // 30 days (changed from 72 hours)
        CHANNELS: 12 * 60 * 60, // 12 hours
        MESSAGES: 2592000, // 30 days
        FEEDS: 30 * 24 * 60 * 60, // 30 days
        ENTITIES: 24 * 60 * 60, // 24 hours
    },
    RETENTION: {
        REPORTS: 365 * 24 * 60 * 60, // 1 year
        ENTITIES: 7 * 24 * 60 * 60, // 7 days
    },
    REFRESH: {
        MESSAGES: 5 * 60, // 5 minutes
        CHANNELS: 60 * 60, // 1 hour
        FEEDS: 2 * 60 * 60, // 2 hours
        ENTITIES: 12 * 60 * 60, // 12 hours
    },
};

// Time-based configuration values (in milliseconds)
export const TIME = {
    // Base units (seconds)
    SECOND_SEC: 1,
    MINUTE_SEC: 60,
    HOUR_SEC: 60 * 60,
    DAY_SEC: 24 * 60 * 60,
    WEEK_SEC: 7 * 24 * 60 * 60,
    MONTH_30_SEC: 30 * 24 * 60 * 60,
    YEAR_365_SEC: 365 * 24 * 60 * 60,

    // Base units (milliseconds)
    SECOND_MS: 1000,
    MINUTE_MS: 60 * 1000,
    HOUR_MS: 60 * 60 * 1000,
    DAY_MS: 24 * 60 * 60 * 1000,
    WEEK_MS: 7 * 24 * 60 * 60 * 1000,
    MONTH_30_MS: 30 * 24 * 60 * 60 * 1000,
    YEAR_365_MS: 365 * 24 * 60 * 60 * 1000,

    // Common windows (milliseconds)
    FIVE_MINUTES_MS: 5 * 60 * 1000,
    FIFTEEN_MINUTES_MS: 15 * 60 * 1000,
    THIRTY_MINUTES_MS: 30 * 60 * 1000,

    // Backward compatible aliases
    ONE_HOUR_MS: 60 * 60 * 1000,
    TWO_HOURS_MS: 2 * 60 * 60 * 1000,
    SIX_HOURS_MS: 6 * 60 * 60 * 1000,
    TWENTY_FOUR_HOURS_MS: 24 * 60 * 60 * 1000,

    // Timeframes and cron mapping
    TIMEFRAMES: ['2h', '6h'] as const,
    CRON: {
        '2h': 2,
        '6h': 6,
    },

    // Helper converters
    minutesToMs: (n: number): number => n * 60 * 1000,
    hoursToMs: (n: number): number => n * 60 * 60 * 1000,
    daysToMs: (n: number): number => n * 24 * 60 * 60 * 1000,
    minutesToSec: (n: number): number => n * 60,
    hoursToSec: (n: number): number => n * 60 * 60,
    daysToSec: (n: number): number => n * 24 * 60 * 60,
};

// AI/LLM configuration
export const AI = {
    REPORT_GENERATION: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 1000,
        OUTPUT_BUFFER: 12288,
        MAX_CONTEXT_TOKENS: 128000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: 'You are an experienced news wire journalist. Always complete your full response. Respond in valid JSON format with: {"headline": "clear, specific, descriptive headline in ALL CAPS", "city": "single city name in title case (e.g. New York, Tel Aviv, São Paulo, Texas, Moscow, etc.) - NOT all caps", "body": "cohesive narrative with paragraphs separated by double newlines (\\n\\n)"}. The body field must be a single string, not an array or object.',

        PROMPT_TEMPLATE: `
Generate a comprehensive news report based on the provided sources and a previous report (if provided).

CURRENT DATE: {currentDate}

LEAD PARAGRAPH REQUIREMENTS (CRITICAL):
- First paragraph MUST answer: WHO did WHAT, WHEN, WHERE, WHY (and HOW if relevant)
- Include specific names, exact numbers, precise locations, and exact timing
- Keep lead focused and under 50 words when possible
- Lead should capture the most newsworthy aspect of the story

STRUCTURE REQUIREMENTS (INVERTED PYRAMID):
- Lead paragraph: Essential facts answering 5Ws and 1H
- Second paragraph: Most important supporting details and context
- Third paragraph: Additional significant information
- Remaining paragraphs: Background, related context, and secondary details in descending order of importance
- Most critical information always comes first

SOURCE ATTRIBUTION REQUIREMENTS:
- Reference sources for major claims ("according to [official]", "as stated by [agency]")
- Include timing context ("announced this morning", "confirmed yesterday", "said in a statement")
- Distinguish between official statements and reported information
- Aim for at least one clear attribution per paragraph
- When multiple sources report similar information, note the consensus

CORE REQUIREMENTS:
- Write a cohesive narrative summarizing the most important verified developments
- Use only verified facts and direct quotes from official statements
- Maintain strictly neutral tone - NO analysis, commentary, or speculation
- Do NOT use uncertain terms like "likely", "appears to", or "is seen as"
- Do NOT include additional headlines within the body text
- Double-check all name spellings for accuracy
- Reference timing relative to current date when relevant (e.g., "yesterday", "this morning", "last week")
- Donald Trump is the current president of the United States, elected in 2016 and re-elected in 2024.

WHEN A PREVIOUS REPORT IS PROVIDED:
- Update ongoing stories with new information from current sources
- Prioritize newer information from current sources in the lead
- Carry forward unresolved significant topics from previous report
- Only omit previous topics if they are clearly superseded or resolved
- Maintain story continuity while emphasizing new developments

FORMAT:
- Headline: Specific, non-sensational, in ALL CAPS
- City: Single city name in title case (e.g. New York, Tel Aviv, São Paulo) - NOT all caps
- Body: A single string containing cohesive paragraphs separated by double newlines (\\n\\n), following inverted pyramid structure. DO NOT use arrays or objects for paragraphs.

<previous_report_context>
{previousReportContext}
</previous_report_context>

<new_sources>
{sources}
</new_sources>

Generate your complete JSON response now:

EXAMPLE FORMAT:
{
  "headline": "EXAMPLE HEADLINE IN ALL CAPS",
  "city": "Example City",
  "body": "This is the first paragraph with essential facts.\\n\\nThis is the second paragraph with supporting details.\\n\\nThis is the third paragraph with additional context."
}
`,
    },
    ENTITY_EXTRACTION: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 500,
        OUTPUT_BUFFER: 4096,
        MAX_CONTEXT_TOKENS: 32000,
        MAX_ATTEMPTS: 2,
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
        CURATE_PROMPT_GERAL: `Você é um curador especializado em notícias brasileiras de alto impacto, focado em fatos e desenvolvimentos concretos sobre o Brasil. Analise os seguintes artigos e selecione apenas notícias factuais sobre:

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

        CURATE_PROMPT_MERCADO: `Você é um curador de notícias financeiras e de mercado. Analise os artigos a seguir e selecione todas as notícias que contenham fatos relevantes sobre empresas, ações, indicadores econômicos, movimentos de mercado, fusões, aquisições, resultados financeiros, ou eventos que impactem o mercado financeiro brasileiro ou internacional. Não exclua notícias apenas por serem sobre empresas específicas ou movimentos de preço. Priorize fatos concretos, dados numéricos, anúncios oficiais e desenvolvimentos que possam interessar investidores ou analistas.

Para cada artigo selecionado, forneça:
- Uma pontuação de importância (1-10)
- Uma explicação objetiva do motivo da seleção

Artigos para análise:
{articles}

Responda no seguinte formato JSON:
{
    "selectedStories": [
        {
            "title": "título exato do artigo",
            "importance": número (1-10),
            "reasoning": "explicação objetiva do motivo da seleção"
        }
    ],
    "unselectedStories": [
        {
            "title": "título exato do artigo"
        }
    ]
}

Importante:
- Inclua notícias sobre empresas, ações, índices, resultados, fusões, aquisições, e eventos relevantes do mercado
- Mantenha os títulos exatamente como estão no original
- Responda SEMPRE em português`,
        SUMMARIZE_PROMPT_GERAL: `Você é um editor especializado em criar resumos objetivos e informativos das principais notícias do Brasil. Analise as notícias selecionadas e crie um resumo estruturado que destaque todos os desenvolvimentos importantes do dia, agrupando-os de forma natural e priorizando pela relevância.

        DIRETRIZES GERAIS:

        1. Estrutura Adaptativa:
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

        ## Destaques
        [Lista dos desenvolvimentos mais significativos, agrupados por temas relevantes]

        [Seções Dinâmicas baseadas no conteúdo disponível]
        [Agrupe notícias relacionadas sob títulos relevantes]
        [Omita seções quando não houver conteúdo relevante]

        Importante:
        - Adapte as seções ao conteúdo do dia
        - Use marcadores para clareza
        - Mantenha foco em fatos verificáveis
        - Evite repetições entre seções
        - Responda SEMPRE em português`,
        SUMMARIZE_PROMPT_MERCADO: `Você é um editor especializado em criar resumos objetivos e informativos das principais notícias de mercado e finanças do Brasil. Analise as notícias selecionadas e crie um resumo estruturado que destaque todos os desenvolvimentos mais relevantes para investidores, empresas e o cenário econômico, agrupando-os por temas e priorizando pela relevância para o mercado.

        DIRETRIZES GERAIS:

        1. Estrutura Adaptativa:
           - Agrupe notícias relacionadas a empresas, indicadores, fusões, resultados e movimentos de mercado
           - Crie seções dinâmicas baseadas no conteúdo disponível
           - Priorize a relevância para o mercado financeiro e impacto econômico

        2. Critérios de Qualidade:
           - Foque em fatos verificáveis, dados numéricos e anúncios oficiais
           - Mantenha linguagem clara e direta
           - Destaque impactos em empresas, setores e investidores
           - Evite especulações e opiniões
           - Preserve contexto necessário para entendimento

        3. Formatação:
           - Use títulos claros e informativos
           - Empregue marcadores para facilitar leitura
           - Separe parágrafos com quebras duplas
           - Mantenha consistência na formatação

        4. Priorização:
           - Destaque mudanças em indicadores econômicos, resultados financeiros e decisões regulatórias
           - Realce eventos com efeitos práticos no mercado
           - Priorize fatos sobre declarações

        Notícias para análise:
        {articles}

        Formato do Resumo:

        # Resumo de Mercado - [DATA]

        ## Destaques
        [Lista dos desenvolvimentos mais significativos para o mercado, agrupados por temas relevantes]

        [Seções Dinâmicas baseadas no conteúdo disponível]
        [Agrupe notícias relacionadas sob títulos relevantes]
        [Omita seções quando não houver conteúdo relevante]

        Importante:
        - Adapte as seções ao conteúdo do dia
        - Use marcadores para clareza
        - Mantenha foco em fatos verificáveis e relevância para o mercado
        - Evite repetições entre seções
        - Nos 'Destaques', mencione cada desenvolvimento apenas de forma resumida, sem repetir detalhes que aparecerão nas seções seguintes. Não repita o mesmo conteúdo nas duas partes.
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
    FACT_CHECK: {
        // Token estimation for fact-checking prompts
        TOKEN_PER_CHAR: 1 / 4,
        // Tokens reserved for model instructions
        OVERHEAD_TOKENS: 1000,
        // Tokens reserved for output
        OUTPUT_BUFFER: 8192,
        // Maximum context window for fact-checking
        MAX_CONTEXT_TOKENS: 128000,
        // Maximum retries for fact-checking API calls
        MAX_ATTEMPTS: 2,
        // System prompt for fact-checking
        SYSTEM_PROMPT: 'You are a professional fact-checker and news analyst. Your job is to verify claims in news reports, analyze their relevance, and rank them by importance. Use your real-time internet access to verify facts and provide accurate assessments.',

        PROMPT_TEMPLATE: `Analyze the following news report and fact-check its key claims. Use your real-time internet access to verify the information.

REPORT TO ANALYZE:
"""
{reportBody}
"""

HEADLINE: {headline}
CITY: {city}
GENERATED AT: {generatedAt}

TASK:
1. Identify the top 3-5 most important factual claims in this report
2. Verify each claim using current, reliable sources
3. Rank the claims by their importance and impact
4. Provide verification status and confidence level for each claim
5. Suggest improvements to make the report more accurate and comprehensive

ANALYSIS REQUIREMENTS:
- Focus on verifiable facts, not opinions or speculation
- Use multiple reliable sources when possible
- Consider the timeliness of the information
- Assess the overall credibility of the report
- Identify any missing context or important details

Response format (JSON):
{
  "factCheck": {
    "overallCredibility": "high|medium|low",
    "verificationSummary": "brief summary of verification results",
    "claims": [
      {
        "claim": "specific factual claim from the report",
        "verification": "verified|partially-verified|unverified|false",
        "confidence": 0.9,
        "sources": ["source1", "source2"],
        "importance": 9,
        "details": "detailed explanation of verification"
      }
    ],
    "improvements": [
      "suggested improvement 1",
      "suggested improvement 2"
    ],
    "missingContext": ["missing context item 1", "missing context item 2"]
  }
}`,
    },
    EXECUTIVE_SUMMARIES: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 1000,
        OUTPUT_BUFFER: 8192,
        MAX_CONTEXT_TOKENS: 128000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: 'You are an expert news analyst. Your job is to create a concise, factual executive summary in simple, readable Markdown, focusing on the most important events of the last 6 hours. Prioritize by importance/impact first, then recency as a secondary factor. Strongly prefer more recent developments when importance is similar. Within each section, order items by (1) importance, (2) newest-to-oldest when time can be inferred. Do not include any commentary or speculation. Only include events that are significant and newsworthy. Output must be valid Markdown.',
        PROMPT_TEMPLATE: `Create a concise executive summary in Markdown of the following news reports, focusing on the most important events of the last 6 hours.

For each major topic or region, create a section with a Markdown heading (## Section Name) followed by bullet points summarizing the key developments.

Do not include any commentary, speculation, and NEVER include a title (like "Executive Summary", or "Executive Summary: Key Global Developments (Past 6 Hours)"). Only include events that are significant and newsworthy.

SELECTION AND ORDERING RULES (CRITICAL):
- Selection priority: choose developments with the highest long-term impact and strategic significance.
- Consider both immediate effects and broader geopolitical implications when assessing importance.
- If two items are similarly important, prefer the more recent one.
- For ongoing stories, emphasize the newest information; include minimal earlier context only if essential to understand the update.
- Within each section, order bullet points by importance first; when importance is similar, order newest to oldest (e.g., using GENERATED_AT when available).

PREVIOUS EXECUTIVE SUMMARIES (if any):
{previousExecutiveSummaries}

REPORTS TO ANALYZE:
"""
{reportBody}
"""

Respond ONLY with valid Markdown using ## headings for each section, followed by bullet points summarizing the most important events of the last 6 hours.`,
        MINI_PROMPT_TEMPLATE: `Given the following Executive Summary, write a much more compact version, preserving all key facts and events.
For each section in the summary, output a Markdown section heading (## Section Name) followed by a concise bullet point list of the most important facts/events from that section.
Do NOT include a top-level 'Executive Summary' heading or any introductory text.
Keep each section to a maximum of 3 bullet points, and the entire summary to 5 sections or fewer.
Use bold for key entities. Order bullets by long-term impact and strategic significance first, then recency (newest→oldest) when time can be inferred. When trimming, prioritize developments with broader geopolitical implications; if importance is similar, keep the more recent.

Executive Summary:
{executiveSummary}`,
    },
    MKTNEWS_SUMMARIES: {
        TOKEN_PER_CHAR: 1 / 4,
        OVERHEAD_TOKENS: 500,
        OUTPUT_BUFFER: 4096,
        MAX_CONTEXT_TOKENS: 32000,
        MAX_ATTEMPTS: 3,
        SYSTEM_PROMPT: 'You are a financial news desk editor. Generate a concise, thematic prose summary based on live flash updates. Focus on the most market-significant developments, grouping related events into coherent narrative paragraphs. Respond with clear Markdown paragraphs using thematic headings. Exclude routine data releases unless they show unusual patterns or significant changes. Do not add commentary or speculation.',
        PROMPT_TEMPLATE: `Create a concise market summary in Markdown prose based on the following market news messages from the last hour. Reference the three most recent previous summaries for context continuity. 

Structure your response using thematic paragraphs with **bold headings** (e.g., **Geopolitics**, **Equities**, **Commodities**, **Currencies**, etc.). Write flowing narrative prose that connects related developments into coherent stories. Include specific times only for the most significant market-moving events or when timing is crucial for understanding the sequence of events. Focus on creating a readable narrative rather than a chronological list.

EXAMPLE FORMAT:
**Geopolitics:** Diplomatic tensions eased as Trump and Putin engaged in direct talks, signaling potential policy shifts that could affect global risk sentiment.

**Equities:** Market sentiment shifted as CFTC data revealed conflicting S&P 500 positioning, with fund managers adding 46,675 long contracts while speculators increased shorts by 74,016 contracts.

**Commodities:** Oil markets saw a notable shift as speculators flipped to net short positions for the first time recently, while gold positions were trimmed by 7,586 contracts.

PREVIOUS SUMMARIES (most recent first):
{previousSummaries}

CURRENT MESSAGES:
"""
{messages}
"""

Respond ONLY with valid Markdown prose using thematic paragraphs.`,
    },
};

// Centralized task timeouts for cron jobs (milliseconds)
export const TASK_TIMEOUTS = {
  MESSAGES: 300000,        // 5 minutes
  MKTNEWS: 60000,          // 1 minute
  MKTNEWS_SUMMARY: 90000,  // 1.5 minutes
  EXECUTIVE_SUMMARY: 180000, // 3 minutes
  REPORTS: 300000,         // 5 minutes
  FEEDS: 240000,           // 4 minutes
} as const;

export type TimeframeKey = typeof TIME.TIMEFRAMES[number];

export const RSS_FEEDS: Record<string, string> = {
    'CNN-Brasil': 'https://www.cnnbrasil.com.br/feed/',
    'BBC-Brasil': 'https://feeds.bbci.co.uk/portuguese/rss.xml',
    // 'G1': 'https://g1.globo.com/rss/g1/',
    'UOL': 'https://rss.uol.com.br/feed/noticias.xml',
    'G1 - Política': 'https://g1.globo.com/rss/g1/politica/',
    'G1 - Economia': 'https://g1.globo.com/rss/g1/economia/',
    'Investing.com Brasil - Empresas': 'https://br.investing.com/rss/news_356.rss',
    'Investing.com Brasil - Mercado': 'https://br.investing.com/rss/news_25.rss',
};

export const BRAZIL_NEWS_TOPICS = {
    'geral': {
        name: 'Giro Geral',
        feeds: ['CNN-Brasil', 'BBC-Brasil', 'G1 - Política', 'G1 - Economia', 'UOL']
    },
    'mercado': {
        name: 'Mercado',
        feeds: ['Investing.com Brasil - Empresas', 'Investing.com Brasil - Mercado']
    }
} as const;

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

export const UI = {
    FULL_SCREEN_PAGES: ['/news-globe', '/power-network', '/entities/graph'],
};
