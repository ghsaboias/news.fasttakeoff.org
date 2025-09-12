# System Architecture Analysis

This document provides a comprehensive infrastructure diagram and architectural analysis of the news.fasttakeoff.org system to identify fundamental type organization patterns for better code structure.

## System Overview

The system is a **real-time news aggregation and AI-powered report generation platform** that processes Discord messages, RSS feeds, and market data to create structured news reports with intelligent content extraction and social media distribution.

## Infrastructure Layers Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                               │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js App Router Pages                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   Homepage      │  │  Current Events │  │  Executive Orders       │ │
│  │   (/)           │  │  (/current-     │  │  (/executive-orders)    │ │
│  │                 │  │   events)       │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   News Globe    │  │    Entities     │  │  Power Network          │ │
│  │   (/news-globe) │  │   (/entities)   │  │  (/power-network)       │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  React Components (shadcn/ui + Custom)                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  ReportCard     │  │  MessageItem    │  │  Entity Graph           │ │
│  │  EntityDisplay  │  │  TweetEmbed     │  │  NewsGlobe              │ │
│  │  LinkPreview    │  │  MediaPreview   │  │  CronMonitor            │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Next.js API Routes (/api/*)                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   /reports      │  │   /messages     │  │   /entities             │ │
│  │   /channels     │  │   /mktnews      │  │   /executive-orders     │ │
│  │   /feeds        │  │   /newsletter   │  │   /admin                │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  Middleware & Route Handlers                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Authentication │  │   Rate Limiting │  │   CORS & Security       │ │
│  │  (Clerk)        │  │   Caching       │  │   API Key Validation    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  Data Services (Business Logic)                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  ReportService  │  │MessagesService  │  │ChannelsService          │ │
│  │  • Dynamic      │  │  • Fetch from   │  │  • Channel metadata     │ │
│  │    reports      │  │    Discord API  │  │  • Permission checks    │ │
│  │  • AI generation│  │  • Time windows │  │  • Activity tracking    │ │
│  │  • Context mgmt │  │  • Message cache│  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  FeedsService   │  │  MktNewsService │  │WindowEvaluationService  │ │
│  │  • RSS parsing  │  │  • Market data  │  │  • Activity analysis    │ │
│  │  • Content      │  │  • Real-time    │  │  • Dynamic scheduling   │ │
│  │    curation     │  │    updates      │  │  • Report triggering    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  AI & Processing Services                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │    ReportAI     │  │EntityExtraction │  │  FactCheckService       │ │
│  │  • LLM prompts  │  │  • NER          │  │  • Claim verification   │ │
│  │  • Context mgmt │  │  • Relevance    │  │  • Source attribution  │ │
│  │  • Multi-provider│  │    scoring     │  │  • Credibility scoring  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  Integration Services                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │ FacebookService │  │ TwitterService  │  │ InstagramService        │ │
│  │ • Auto-posting  │  │ • Tweet embeds  │  │ • Image generation      │ │
│  │ • Media upload  │  │ • OAuth flow    │  │ • Story publishing      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Cloudflare Infrastructure                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  D1 Databases   │  │  KV Namespaces  │  │   R2 Object Storage     │ │
│  │  • Reports DB   │  │  • REPORTS_CACHE│  │   • Instagram images    │ │
│  │  • Emails DB    │  │  • MESSAGES_    │  │   • Media assets        │ │
│  │  • Structured   │  │    CACHE        │  │                         │ │
│  │    SQL storage  │  │  • ENTITIES_    │  │                         │ │
│  │                 │  │    CACHE        │  │                         │ │
│  │                 │  │  • FEEDS_CACHE  │  │                         │ │
│  │                 │  │  • MKTNEWS_     │  │                         │ │
│  │                 │  │    CACHE        │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  External Data Sources                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Discord API    │  │   RSS Feeds     │  │   Federal Register      │ │
│  │  • Live messages│  │  • CNN Brasil   │  │   • Executive Orders    │ │
│  │  • Channel data │  │  • BBC Brasil   │  │   • Official documents  │ │
│  │  • User metadata│  │  • G1 Política  │  │                         │ │
│  │                 │  │  • Bloomberg    │  │                         │ │
│  │                 │  │  • Guardian     │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  AI Model Providers                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   OpenRouter    │  │      Groq       │  │    Perplexity           │ │
│  │  • Gemini 2.5   │  │  • Llama 4      │  │    • Sonar              │ │
│  │    Flash Lite   │  │    Maverick     │  │    • Fact checking      │ │
│  │  • Qwen3 235B   │  │                 │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORCHESTRATION LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Cron Jobs (Cloudflare Workers)                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │   Every 15min   │  │    Every 2hrs   │  │     Every 6hrs          │ │
│  │  • Message      │  │  • Feed         │  │  • Executive            │ │
│  │    updates      │  │    summaries    │  │    summaries            │ │
│  │  • Window       │  │  • Social media │  │                         │ │
│  │    evaluation   │  │    posting      │  │                         │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  Dynamic Report Generation Engine                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │Activity Monitor │  │Window Evaluator │  │  Report Generator       │ │
│  │• Channel metrics│  │• Trigger logic  │  │  • Context-aware        │ │
│  │• Message counts │  │• Overlap        │  │  • Multi-pass AI        │ │
│  │• Pattern detect │  │  prevention     │  │  • Source attribution  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
│                                                                         │
│  Newsletter Generation Pipeline                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐ │
│  │  Data Fetcher   │  │  Content        │  │  HTML Export            │ │
│  │  • D1 queries   │  │  Controller     │  │  • Clean templates      │ │
│  │  • Story        │  │  • Length adj.  │  │  • Image selection      │ │
│  │    ranking      │  │  • Image toggle │  │  • Email formatting     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Core Data Flow Architecture

### 1. Message Ingestion Flow

```
Discord API → MessagesService → KV Cache (messages:{channelId})
     │                              │
     └── Channel Metadata ──────────┴──→ ChannelsService → KV Cache
```

### 2. Dynamic Report Generation Flow

```
WindowEvaluationService
     │
     ├── Activity Analysis (7-day averages)
     │   ├── High Activity: ≥3 msgs OR 30min timeout
     │   ├── Medium Activity: ≥2 msgs OR 60min timeout  
     │   └── Low Activity: ≥1 msg OR 180min timeout
     │
     ├── Overlap Prevention (check last 4hrs)
     │
     └── Report Generation
         │
         ├── MessagesService.getMessagesInTimeWindow()
         │
         ├── ReportAI.generateWithWindowContext()
         │   ├── Context from recent reports
         │   ├── Window-aware prompting
         │   └── Multi-provider AI routing
         │
         └── Storage: KV Cache + D1 Database
```

### 3. Content Enhancement Pipeline

```
Generated Report
     │
     ├── EntityExtraction (PERSON/ORGANIZATION/LOCATION)
     │
     ├── FactCheckService (verification with sources)
     │
     ├── SourceAttribution (message-to-sentence mapping)
     │
     └── Social Media Distribution
```

### 4. Newsletter Generation Flow

```
D1 Database Query (top story per channel, 24hrs)
     │
Newsletter Builder UI (localhost:3001)
     │
     ├── Story Selection/Removal
     ├── Content Length Control (Brief/Medium/Full)
     ├── Image Selection Toggle
     │
     └── HTML Export (clean, no UI controls)
```

## Domain Architecture & Business Boundaries

### Core Business Domains

#### 1. **News Intelligence Domain**
- **Purpose**: Real-time news processing and AI-powered report generation
- **Key Entities**: `Report`, `DiscordMessage`, `DiscordChannel`
- **Services**: `ReportService`, `MessagesService`, `ChannelsService`
- **Responsibilities**: Message ingestion, dynamic window evaluation, AI report generation

#### 2. **Content Analysis Domain** 
- **Purpose**: Content understanding and enhancement
- **Key Entities**: `ExtractedEntity`, `FactCheckResult`, `SourceAttribution`
- **Services**: `EntityExtractor`, `FactCheckService`, `SourceAttributionService`
- **Responsibilities**: Entity extraction, fact verification, source tracking

#### 3. **External Content Domain**
- **Purpose**: RSS feeds, market data, government documents
- **Key Entities**: `FeedItem`, `MktNewsMessage`, `ExecutiveOrder`
- **Services**: `FeedsService`, `MktNewsService`, `ExecutiveOrdersService`
- **Responsibilities**: External content aggregation and curation

#### 4. **Distribution Domain**
- **Purpose**: Content publishing and user engagement
- **Key Entities**: `TweetEmbed`, `LinkPreview`, `ExecutiveSummary`
- **Services**: `FacebookService`, `TwitterService`, `InstagramService`
- **Responsibilities**: Social media posting, newsletter generation, user notifications

#### 5. **System Orchestration Domain**
- **Purpose**: Workflow automation and system coordination
- **Key Entities**: `CronStatusData`, `ChannelMessageCounts`, `CacheManager`
- **Services**: `WindowEvaluationService`, `ServiceFactory`
- **Responsibilities**: Dynamic scheduling, cache management, system monitoring

## Infrastructure Layers & Type Organization

### Layer 1: **Foundation Types** (Cross-cutting)
**Location**: `src/lib/types/foundation/`
- **Infrastructure**: Database connections, cache interfaces, API clients
- **Configuration**: Environment variables, feature flags, provider configs
- **Common**: Timestamps, IDs, error handling, pagination

### Layer 2: **Domain Core Types** (Business entities)
**Location**: `src/lib/types/domains/`
- **News**: `Report`, `DiscordMessage`, `DiscordChannel`
- **Content**: `ExtractedEntity`, `FactCheckResult`, `SourceAttribution` 
- **External**: `FeedItem`, `MktNewsMessage`, `ExecutiveOrder`
- **Distribution**: `TweetEmbed`, `LinkPreview`, `ExecutiveSummary`

### Layer 3: **Service Types** (Business operations)
**Location**: `src/lib/types/services/`
- **Processing**: AI prompts, analysis results, transformation configs
- **Integration**: API request/response types, external service contracts
- **Orchestration**: Workflow states, scheduling configs, monitoring data

### Layer 4: **Transport Types** (API/UI contracts)
**Location**: `src/lib/types/transport/`
- **API**: Request/response schemas, error types, validation rules
- **UI**: Component props, form data, view models, interaction events

## External System Integration Patterns

### Data Ingestion Pattern
```
External Source → Service Layer → Cache Layer → Database
     │               │              │           │
Discord API     MessagesService   KV Cache    D1 DB
RSS Feeds       FeedsService      KV Cache      -
MktNews         MktNewsService    KV Cache      -
Fed Register    ExecutiveOrders   KV Cache      -
```

### AI Processing Pattern
```
Raw Content → Context Builder → AI Provider → Post-processor → Storage
     │             │              │              │            │
Messages      ReportContext   OpenRouter/     EntityExtract  KV + D1
Feeds         WindowContext   Groq/           FactCheck      Cache
Previous      TokenManage     Perplexity      SourceAttrib   Database
```

### Caching Strategy Pattern
```
Layer 1: KV Cache (Fast access, 2-week TTL)
Layer 2: D1 Database (Persistent, structured queries)
Layer 3: Edge Cache (CDN, static content)
```

## Type Organization Insights

### Fundamental vs Technical Types

**Truly Foundational** (shared across all layers):
- `ID`, `Timestamp`, `APIResponse<T>`, `CacheKey`
- `Environment`, `ProviderConfig`, `FeatureFlag`
- `PaginationInfo`, `ValidationError`, `AsyncResult<T>`

**Domain-Specific** (belong to business boundaries):
- News Intelligence: `Report`, `DiscordMessage`, `WindowEvaluation`
- Content Analysis: `Entity`, `FactCheck`, `SourceAttribution`
- External Content: `FeedItem`, `ExecutiveOrder`, `MktNewsMessage`

**Infrastructure-Specific** (technical concerns):
- Database: `ReportRow`, `DatabaseClient`, `QueryBuilder`
- Cache: `CacheManager`, `KVNamespace`, `TTLConfig`
- AI: `PromptTemplate`, `ModelProvider`, `TokenUsage`

### Recommended Type Structure

```
src/lib/types/
├── foundation/          # Cross-cutting, infrastructure
│   ├── common.ts       # IDs, timestamps, pagination
│   ├── config.ts       # Environment, feature flags
│   ├── cache.ts        # Cache interfaces, TTL configs
│   └── api.ts          # Generic API patterns
├── domains/            # Business entities by domain
│   ├── news/           # Report, Message, Channel
│   ├── content/        # Entity, FactCheck, Attribution
│   ├── external/       # Feeds, MktNews, ExecutiveOrders  
│   └── distribution/   # Social, Newsletter, Publishing
├── services/           # Business operation types
│   ├── processing/     # AI, analysis, transformation
│   ├── integration/    # External API contracts
│   └── orchestration/  # Workflow, scheduling, monitoring
└── transport/          # Interface contracts
    ├── api/            # REST API schemas
    └── ui/             # Component props, view models
```

This organization separates **what the business does** (domains) from **how it does it** (services/infrastructure) while maintaining clear boundaries that match the actual system architecture.

## Key Architectural Insights

1. **Event-Driven Architecture**: System responds to real-time Discord activity with intelligent window evaluation
2. **AI-First Processing**: Multiple AI providers with context-aware prompt management
3. **Multi-Layer Caching**: KV for speed, D1 for persistence, edge for static content
4. **Domain Separation**: Clear boundaries between news processing, content analysis, and distribution
5. **Dynamic Scheduling**: Activity-based report generation rather than fixed intervals
6. **Comprehensive Integration**: Discord, RSS, market data, government APIs, social media

The type organization should reflect these architectural realities rather than just content similarity, ensuring maintainability as the system scales.