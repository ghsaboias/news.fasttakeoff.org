# Fast Takeoff News

A Next.js application aggregating executive orders from the Federal Register API and generating real-time reports from Discord channel messages. Written in TypeScript, it uses Tailwind CSS for styling, Radix UI for components, and deploys via Cloudflare Workers with KV caching. I patched the Cloudflare Worker to expose a _scheduled_ route in order to trigger report generation with cron jobs. I use open-next to adapt the Next.js build for Cloudflare's runtime.

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/ghsaboias/news.fasttakeoff.org)

## Overview

- **Purpose**: Fetch and display executive orders, monitor Discord channels for bot activity and generate structured reports using a configurable AI provider (currently Gemini 2.5 Flash via OpenRouter, with Groq/Llama 4 Maverick as alternative).
- **Deployment**: Hosted at news.fasttakeoff.org via Cloudflare Workers.
- **Key Integrations**: Federal Register API, Discord API, configurable AI Provider (e.g., Groq, OpenRouter), Clerk for authentication, Stripe for subscriptions, Twitter API, Instagram Graph API, Facebook Graph API.

## Technical Details

- **Framework**: Next.js 15.2.4 (React 19.0.0)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 3.4.14 with custom theming (src/app/globals.css), shadcn/ui components
- **UI Primitives**: Radix UI (@radix-ui/react-\*) for accordion, dialog, select, etc. (often via shadcn/ui)
- **Deployment**: Cloudflare Workers (wrangler.toml), built with OpenNextJS (@opennextjs/cloudflare)
- **Authentication**: Clerk (@clerk/nextjs)
- **Payments**: Stripe (via API, for subscriptions)
- **External APIs**:
  - Federal Register: https://www.federalregister.gov/api/v1
  - Discord: https://discord.com/api/v10
  - AI Providers: (Configurable, see `src/lib/config.ts`)
    - Groq: https://api.groq.com/openai/v1
    - OpenRouter: https://openrouter.ai/api/v1
  - Twitter API: https://api.twitter.com/2/
  - Instagram Graph API: https://graph.instagram.com/
  - Facebook Graph API: https://graph.facebook.com/
  - Cloudflare Browser Rendering API: https://api.cloudflare.com/client/v4/accounts (for Instagram post image generation)
  - Cloudflare R2 Storage: https://images.fasttakeoff.org (for image hosting)
- **Dependencies**: groq-sdk, lucide-react, class-variance-authority, full list in package.json
- **Configuration**: ESLint (eslint.config.mjs), PostCSS (postcss.config.mjs), TypeScript (tsconfig.json)

### Data Management and Transformation

The application's core data handling is managed by services and transformers within the `src/lib/` directory:

- **`src/lib/data/channels-service.ts` (`ChannelsService`)**: Fetches Discord channels from the API, filters them based on criteria (type, emoji prefix, permissions), and caches the results. Essential for identifying relevant channels for news monitoring.
- **`src/lib/data/messages-service.ts` (`MessagesService`)**: Responsible for fetching messages from specified Discord channels, handling pagination, and caching them. Provides the raw source material for report generation.
- **`src/lib/data/executive-orders.ts`**: Fetches lists of executive orders and individual order details from the Federal Register API. Implements caching for individual orders and mechanisms to look up orders by number.
- **`src/lib/data/report-service.ts` (`ReportService`)**: Core service that orchestrates the generation of news reports. It retrieves messages, prepares prompts for the AI, calls the AI provider, processes the response, and caches the generated reports. It also handles social media posting through integration with Twitter, Instagram, and Facebook services.
- **`src/lib/utils/report-ai.ts` (`ReportAI`)**: Handles AI interactions for report generation, including prompt preparation, API calls, and response processing.
- **`src/lib/utils/report-cache.ts` (`ReportCache`)**: Manages report caching operations using Cloudflare KV storage, including storage, retrieval, and cleanup of generated reports.
- **`src/lib/transformers/executive-orders.ts`**: Transforms raw executive order data fetched from the Federal Register API into a structured `ExecutiveOrder` type used throughout the application, simplifying data handling in the frontend and other services.

### Common Utilities & API Helpers

- **`src/lib/utils.ts`**: Provides a collection of general utility functions for tasks such as date/time formatting and manipulation (e.g., `formatDate`, `formatTime`, `getStartDate`), parsing specific text formats (e.g., `parseDispositionNotes` for executive order relations), class name construction for Tailwind CSS (`cn`), and accessing the Cloudflare Worker environment context (`getCacheContext`).
- **`src/lib/api-utils.ts`**: Offers helpers for Next.js API routes, including a `withErrorHandling` higher-order function to standardize error responses and JSON formatting, and default cache headers (`API_CACHE_HEADERS`) for API responses.

## Core Features

### 1. Current Events (Discord Integration)

The Current Events section provides real-time monitoring and AI-powered report generation from Discord channels.

#### Functionality

- Monitors specific Discord channels for bot messages
- Filters messages using bot username and discriminator
- Generates AI-powered reports with headline, city, and body content
- Supports multiple timeframes for report generation
- Translation support for multiple languages

#### API Endpoints

- `GET /api/reports` - Fetch cached reports
- `GET /api/translate` - Translate report content

#### Required Environment Variables

```bash
# Discord Integration
DISCORD_TOKEN=<your-discord-bot-token>
DISCORD_GUILD_ID=<your-guild-id>

# AI Provider (Choose one)
GROQ_API_KEY=<your-groq-api-key>
OPENROUTER_API_KEY=<your-openrouter-api-key>
```

#### Troubleshooting

- Verify Discord bot permissions and token
- Check AI provider status and API keys
- Review logs for specific error messages

### 2. News Globe

Interactive 3D visualization of news reports with geographic data.

#### Functionality

- 3D visualization using Three.js
- Real-time geocoding of news locations
- Interactive markers for report display

#### API Endpoints

- `GET /api/geocode` - Geocode city names for globe placement

### 3. Brazil News

Automated aggregation and AI-powered summarization of Brazilian news.

#### Functionality

- Aggregates news from major Brazilian RSS feeds
- Two-stage AI processing:
  - Curation based on impact and verifiability
  - Structured summarization by categories
- Historical archive with timestamp selection
- Hourly updates with caching

#### API Endpoints

- `GET /api/summaries/list` - List available summaries
- `GET /api/summaries/[key]` - Fetch specific summary

#### Required Environment Variables

```bash
# Social Media Integration
INSTAGRAM_ACCESS_TOKEN=<your-instagram-long-lived-access-token>
TWITTER_CLIENT_ID=<your-twitter-app-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>
FACEBOOK_APP_ID=<your-facebook-app-id>
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
FACEBOOK_PAGE_ID=<your-facebook-page-id>
FACEBOOK_PAGE_ACCESS_TOKEN=<your-facebook-page-access-token>

# Discord Integration
DISCORD_TOKEN=<your-discord-bot-token>
DISCORD_GUILD_ID=<your-guild-id>

# Authentication & Payments
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PRICE_ID=<your-stripe-price-id>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# API Configuration
SERVER_API_URL=https://news.fasttakeoff.org  # Production URL
# Use http://localhost:8787 for local development

# Optional Services
GOOGLE_GEOCODING_API_KEY=<your-google-geocoding-api-key>  # For News Globe
```

#### Troubleshooting

- RSS Feed Issues:
  - System continues with available feeds if some fail
  - Check logs for specific feed errors
  - Verify source URLs in configuration
- Cache Management:
  - Clear KV cache through Cloudflare dashboard
  - Cache refreshes hourly
  - Force refresh with `?fresh=true` parameter

### 4. Executive Orders

Tracks and displays executive orders from the Federal Register API.

#### Functionality

- Fetches and displays executive orders
- AI-powered summarization
- Historical tracking and caching
- Structured display of metadata and full text

#### API Endpoints

- `GET /api/executive-orders` - List orders
- `GET /api/executive-orders/[id]` - Get specific order
- `GET /api/summarize` - Generate AI summary

### 5. Source Attribution

AI-powered transparency system that maps content in generated news reports back to their original Discord source messages.

#### Functionality

- **Interactive Highlighting**: Report text segments are visually highlighted and linked to source messages
- **Confidence Scoring**: AI provides confidence scores (0-1) for each attribution with visual feedback
- **Rich Tooltips**: Hover over highlighted text to see original message content, timestamps, and attribution confidence
- **Multiple Text Matching**: Uses exact, normalized, and fuzzy matching strategies to find text positions
- **Intelligent Caching**: Attributions are cached using Cloudflare KV with generation locks to prevent duplicate processing
- **Batch Processing**: Pre-generates attributions for multiple reports with configurable concurrency
- **Graceful Degradation**: Falls back to plain text display when attributions are unavailable

#### Technical Features

- **AI Integration**: Uses structured JSON schema responses from configurable AI providers (Groq/OpenRouter)
- **Fuzzy Text Matching**: Implements sophisticated position finding with 80% similarity threshold for sentence-level matching
- **Error Resilience**: Retry logic with exponential backoff, falls back to previous cached versions on failures
- **Performance Optimization**: Lazy loading, efficient paragraph processing, and color assignment based on message index

#### API Endpoints

- `GET /api/source-attribution?reportId=X&channelId=Y` - Fetch source attributions for specific report

#### Configuration

Key settings in `src/lib/config.ts`:

```typescript
SOURCE_ATTRIBUTION: {
    MAX_ATTEMPTS: 3,              // Retry attempts for AI calls
    OUTPUT_BUFFER: 4096,          // Tokens reserved for AI output
    MAX_CONTEXT_TOKENS: 32000,    // Maximum context window
    SYSTEM_PROMPT: "...",         // AI system instructions
    PROMPT_TEMPLATE: "..."        // Template for user prompts
}
```

#### Data Types

```typescript
interface SourceAttribution {
  id: string; // Unique identifier
  startIndex: number; // Start position in report body
  endIndex: number; // End position in report body
  text: string; // Attributed text content
  sourceMessageId: string; // Source Discord message ID
  confidence: number; // AI confidence score (0-1)
}

interface ReportSourceAttribution {
  reportId: string; // Report identifier
  attributions: SourceAttribution[]; // Array of attributions
  generatedAt: string; // Generation timestamp
  version: string; // Attribution system version
}
```

#### Components

- **AttributedReportViewer**: Main container managing attribution state and API calls
- **InteractiveReportBody**: Renders report text with highlighted attributed segments
- **SourceTooltip**: Rich tooltips displaying source message details and confidence scores

#### Integration

- Integrated with cron jobs for background attribution generation
- Uses same caching strategy as main reports (REPORTS_CACHE KV namespace)
- Cache keys: `attribution:{reportId}`
- Supports cache invalidation for specific reports

## Development and Testing

### Environment Setup

```bash
# API Configuration
SERVER_API_URL=https://news.fasttakeoff.org  # Production URL
# Use http://localhost:8787 for local development

# Authentication & Payments
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PRICE_ID=<your-stripe-price-id>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
```

### Testing Workflow

```bash
# Report Generation Testing
scripts/generate-reports.sh  # Generate test reports
scripts/check-truncation.sh  # Verify report truncation
scripts/full-test.sh        # Full test including build

# Local Development
npm run dev                 # Start local server
npm run preview:patch:test  # Test with Cloudflare Worker
npm run deploy             # Deploy to production
```

### Cache Management

- All endpoints use stale-while-revalidate strategy
- Default cache TTL: 1 hour
- KV namespaces:
  - `EXECUTIVE_ORDERS_CACHE`
  - `REPORTS_CACHE`
  - `CHANNELS_CACHE`
  - `MESSAGES_CACHE`
  - `FEEDS_CACHE`
  - `AUTH_TOKENS`
  - `GEOCODE_CACHE`
  - `SUBSCRIPTIONS_CACHE`
- R2 buckets:
  - `INSTAGRAM_IMAGES` - Stores generated Instagram post images with 7-day retention

## License

MIT

## Basic Project Structure

```
src/
├── app/                  # Next.js pages and API routes
│   ├── api/              # API endpoints
│   │   ├── channels/       # Discord channel related (e.g., /active)
│   │   ├── reports/        # Report generation and retrieval
│   │   ├── geocode/        # Geocoding city names for News Globe
│   │   └── stripe/         # Stripe checkout and webhook
│   ├── current-events/   # Discord channel monitoring UI
│   ├── executive-orders/ # Executive order display UI
│   ├── news-globe/       # Interactive 3D news globe UI
│   ├── profile/          # User profile page (Clerk integrated)
│   ├── sign-in/          # Clerk sign-in page
│   ├── sign-up/          # Clerk sign-up page
│   ├── privacy-policy/   # Privacy policy page
│   └── globals.css       # Tailwind CSS configuration
├── components/           # Reusable React components
│   ├── current-events/   # Channel-specific UI (e.g., ChannelCard.tsx)
│   ├── executive-orders/ # Executive Orders UI
│   ├── source-attribution/ # Source attribution components
│   │   ├── AttributedReportViewer.tsx  # Main attribution container
│   │   ├── InteractiveReportBody.tsx   # Highlighted report text
│   │   └── SourceTooltip.tsx           # Rich source tooltips
│   ├── NewsGlobe.tsx     # 3D interactive news globe component
│   ├── Header.tsx        # Application header with navigation and user auth
│   ├── Footer.tsx        # Application footer
│   └── ui/               # shadcn/ui components (e.g., button.tsx)
├── lib/                  # Utilities and data logic
│   ├── data/             # Core services
│   │   ├── channels-service.ts      # Discord channel management
│   │   ├── messages-service.ts      # Discord message handling
│   │   ├── report-service.ts        # Report generation orchestration
│   │   ├── executive-orders.ts      # Executive order data handling
│   │   ├── feeds-service.ts         # RSS feed processing
│   │   └── rss-service.ts           # RSS feed fetching
│   ├── utils/            # Utility services
│   │   ├── report-ai.ts             # AI integration for reports
│   │   ├── report-cache.ts          # Report caching logic
│   │   ├── report-utils.ts          # Report-related utilities
│   │   ├── twitter-utils.ts         # Twitter-specific utilities
│   │   └── source-attribution/      # Source attribution system
│   │       ├── source-attribution-service.ts  # Attribution orchestration
│   │       ├── source-attribution-ai.ts       # AI-powered attribution generation
│   │       └── index.ts                       # Attribution exports
│   ├── transformers/     # Data transformation (e.g., executive-orders.ts)
│   ├── types/            # TypeScript interfaces (e.g., core.ts)
│   ├── instagram-service.ts         # Instagram API integration
│   ├── twitter-service.ts           # Twitter API integration
│   ├── facebook-service.ts          # Facebook API integration
│   ├── ai-config.ts                 # AI provider configuration
│   └── config.ts                    # Main application configuration
.gitignore              # Excludes node_modules, .next/, etc.
cloudflare-env.d.ts     # Cloudflare Workers env typings
package.json            # Dependencies and scripts
wrangler.toml           # Cloudflare Workers configuration
```

## Setup

### Prerequisites

- Node.js 20+
- npm 10+ (or equivalent package manager)
- Cloudflare account with Workers and KV access
- Environment variables:
  - DISCORD_TOKEN: Discord bot token
  - DISCORD_GUILD_ID: Target Discord guild ID
  - GROQ_API_KEY: Groq API key for report generation (if Groq is active AI provider)
  - OPENROUTER_API_KEY: OpenRouter API key (if OpenRouter is active AI provider)
  - STRIPE_SECRET_KEY: Stripe secret key for payments
  - STRIPE_PRICE_ID: Stripe price ID for the subscription product
  - STRIPE_WEBHOOK_SECRET: Stripe webhook secret for verifying incoming events
  - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: Clerk publishable key
  - CLERK_SECRET_KEY: Clerk secret key
  - NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
  - NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
  - NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
  - NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

### Installation

```bash
git clone https://github.com/ghsaboias/news.fasttakeoff.org.git
cd news.fasttakeoff.org
npm install
```

Create .env.local:

```bash
DISCORD_TOKEN=<your-discord-bot-token>
DISCORD_GUILD_ID=<your-guild-id>
GROQ_API_KEY=<your-groq-api-key>
OPENROUTER_API_KEY=<your-openrouter-api-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PRICE_ID=<your-stripe-price-id>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
SERVER_API_URL=http://localhost:8787 # Or your deployed worker URL
TWITTER_CLIENT_ID=<your-twitter-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>
INSTAGRAM_ACCESS_TOKEN=<your-instagram-access-token>
# INSTAGRAM_ACCOUNT_ID=<your-instagram-account-id> # If moved to env var
```

### Development

Start the dev server:

```bash
npm run dev
```

Access at http://localhost:3000.

### Build & Deployment

Build locally:

```bash
npm run build
```

Preview with Cloudflare Workers:

```bash
npm run preview
```

Deploy to Cloudflare:

```bash
npm run deploy
```

Generates .open-next/ artifacts and deploys via wrangler.

## Functionality

### API Routes:

- **/api/reports**: Generates reports from Discord messages via configurable AI provider; GET fetches cached summaries.
- **/api/channels**: Retrieves guild channels.
- **/api/geocode**: Geocodes a city name (used by News Globe).
- **/api/source-attribution**: Fetches source attributions for specific reports, mapping report content to original Discord messages.
- **/api/stripe/checkout**: Initiates a Stripe checkout session for subscriptions.
- **/api/stripe/webhook**: Handles incoming Stripe webhook events (e.g., `checkout.session.completed`).
- **/api/oembed/twitter**: Provides Twitter OEmbed data for embedded tweets.
- **/api/linkedin/auth**: LinkedIn OAuth authentication.
- **/api/linkedin/callback**: LinkedIn OAuth callback handler.
- **/api/linkedin/test**: LinkedIn API testing endpoint.
- **/api/messages/heatmap**: Generates message activity heatmap data.
- **/api/emails**: Email handling and management.
- **/api/prompt-test**: AI prompt testing and validation.

#### SEO & Content Syndication

- **/api/rss/[feedId]**: RSS feed for specific content categories.
- **/sitemap.xml**: Main sitemap for SEO.
- **/sitemap-index.xml**: Sitemap index for large sites.
- **/news-sitemap.xml**: News-specific sitemap for search engines.

### Frontend:

- **/current-events**: Displays active channels with message previews and report generation.
- **/executive-orders**: Lists and details executive orders with pagination and search.
- **/news-globe**: Shows an interactive 3D globe with geolocated news reports.
- **/brazil-news**: Displays AI-generated summaries of Brazilian news, with historical archive access.
- **/message-activity**: Displays message activity heatmap for Discord channels.
- **/power-network**: Interactive network visualization of political and business relationships.
- **/profile**: User profile page, shows subscription status and allows users to subscribe.
- **/sign-in**: User sign-in page (Clerk).
- **/sign-up**: User sign-up page (Clerk).
- **/privacy-policy**: Application's privacy policy.
- **/rss**: RSS feed endpoint for syndication.
- **/**: Home page featuring an animated hero section, and previews of the latest news reports and executive orders. This page is client-rendered and fetches its data on the client side.

#### Brazil News Display

The Brazil News section provides AI-generated summaries of Brazilian news, with features for historical tracking and comparison:

- **Main View (`/brazil-news`)**: Shows the latest AI-generated summary of Brazilian news, with a dropdown selector for accessing historical summaries.
- **Summary Display**: Each summary is presented in a well-formatted markdown view that includes:
  - Key points and highlights from Brazilian news
  - Proper formatting for bullet points and sections
  - Timestamps for each historical summary
- **Historical Archive**: Users can access and compare summaries from different time periods using a select dropdown, with summaries cached for quick access.
- **Auto-Refresh**: The page revalidates every hour to ensure fresh content.

### Required Environment Variables

```bash
# AI Provider Configuration (Choose one)
GROQ_API_KEY=<your-groq-api-key>        # If using Groq
OPENROUTER_API_KEY=<your-openrouter-api-key>  # If using OpenRouter

# Social Media Integration
INSTAGRAM_ACCESS_TOKEN=<your-instagram-long-lived-access-token>
TWITTER_CLIENT_ID=<your-twitter-app-client-id>
TWITTER_CLIENT_SECRET=<your-twitter-client-secret>
FACEBOOK_APP_ID=<your-facebook-app-id>
FACEBOOK_APP_SECRET=<your-facebook-app-secret>
FACEBOOK_PAGE_ID=<your-facebook-page-id>
FACEBOOK_PAGE_ACCESS_TOKEN=<your-facebook-page-access-token>

# Cloudflare Services
CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>  # For Browser Rendering API
CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>  # For Browser Rendering API

# Discord Integration
DISCORD_TOKEN=<your-discord-bot-token>
DISCORD_GUILD_ID=<your-guild-id>

# Authentication & Payments
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PRICE_ID=<your-stripe-price-id>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# API Configuration
SERVER_API_URL=https://news.fasttakeoff.org  # Production URL
# Use http://localhost:8787 for local development

# Optional Services
GOOGLE_GEOCODING_API_KEY=<your-google-geocoding-api-key>  # For News Globe

# LinkedIn Integration (placeholder for future implementation)
# LINKEDIN_CLIENT_ID=<your-linkedin-client-id>
# LINKEDIN_CLIENT_SECRET=<your-linkedin-client-secret>
```

### Testing and Development

1. Report Generation Testing:

```bash
# If dev server is already running:
scripts/generate-reports.sh  # Generate test reports
scripts/check-truncation.sh  # Verify report truncation

# For full test including build:
scripts/full-test.sh
```

2. Local Development with Cloudflare:

```bash
# Start local development server
npm run dev

# Test with Cloudflare Worker
npm run preview:patch:test  # Required after major code changes

# Deploy to production
npm run deploy
```

### Brazil News Aggregation

The system aggregates and summarizes news from major Brazilian RSS feeds through a two-stage AI process:

1. **Update Cycle**:

   - Automatic hourly updates
   - Historical archives maintained in `FEEDS_CACHE`
   - Accessible via `/brazil-news` with timestamp selection

2. **AI Processing**:
   - Stage 1: Curation of relevant news based on impact and verifiability
   - Stage 2: Structured summarization by categories (Federal Politics, Economy, Judiciary, São Paulo)

### Troubleshooting Common Issues

1. **RSS Feed Failures**:

   - System continues with available feeds if some sources fail
   - Check logs for specific feed errors
   - Verify source URLs in configuration

2. **Cache Issues**:

   - Clear KV cache manually through Cloudflare dashboard
   - Local development uses separate cache
   - Cache automatically refreshes hourly

3. **Report Generation Failures**:
   - Check AI provider status and API keys
   - Verify Discord bot permissions
   - Review logs for specific error messages

### API Routes

1. **Reports and Summaries**:

   - `GET /api/reports` - Fetch cached reports
   - `GET /api/summaries/list` - List available news summaries
   - `GET /api/summaries/[key]` - Fetch specific summary by key
   - `GET /api/translate` - Translate report content

2. **Cache Control**:
   - All endpoints use stale-while-revalidate strategy
   - Default cache TTL: 1 hour
   - Force refresh with `?fresh=true` parameter

#### Executive Order Display

- **List View (`/executive-orders`)**: Displays a paginated and searchable list of executive orders. Initial data is fetched server-side, with client-side components handling search, filtering, and pagination of the loaded set. Each order is presented as a card linking to its detailed view.
- **Detailed View (`/executive-orders/[id]`)**: Shows comprehensive information for a single executive order. This includes:
  - Metadata (title, date, EO number, citation, category).
  - Links to official documents (Federal Register HTML, PDF, full text).
  - **AI-Generated Summary**: An AI-powered summary of the order is generated on-demand (via `/api/summarize`) and displayed. Summaries are cached in the user's browser (`localStorage`) to improve subsequent load times.
  - Full text of the order (rendered from HTML).
  - Links to related executive orders, identified by parsing disposition notes.

#### Current Events (Discord Channel Monitoring)

The "Current Events" section provides insights into real-time information aggregated from monitored Discord channels.

- **Main View (`/current-events`)**: Displays a dashboard of the latest generated reports, with one card per active Discord channel. This view allows users to search for specific topics across all reports and sort channels by activity, recency of reports, or channel name. Each card links to a channel-specific view.
- **Channel Detail View (`/current-events/[channelId]`)**: Shows a chronological timeline of all reports generated for a specific Discord channel, grouped by date. Each report in the timeline links to its detailed view.
- **Report Detail View (`/current-events/[channelId]/[reportId]`)**: This is the most granular view, presenting:
  - The full content of a specific generated report (headline, city, body).
  - **AI-Powered Translation**: Users can translate the report content into multiple languages (English, Spanish, French, German, Portuguese) using an AI translation service (via `/api/translate`).
  - **Source Messages**: An accordion section displays the original Discord messages that were used as sources for generating the report. Each message (`MessageItem.tsx`) can show its content, embeds (titles, descriptions, fields, author), and media attachments (images/videos displayed using `MediaPreview.tsx`).

### Authentication & Authorization

The application uses [Clerk](https://clerk.com/) for user authentication. Users can sign up, sign in, and manage their profile.
The profile page also integrates with [Stripe](https://stripe.com/) to allow users to subscribe to a premium plan.

The AI provider for report generation is configurable via `src/lib/config.ts` (currently using Gemini 2.5 Flash via OpenRouter as the active provider, with Groq/Llama 4 Maverick as an alternative).

### News Globe

A new interactive feature that displays news reports as markers on a 3D globe. It fetches report data, geocodes the associated city, and visualizes it.

- **Technology**: Uses `@react-three/fiber` and `@react-three/drei` for 3D rendering.
- **Data Sources**: News reports from `/api/reports`, geocoding via `/api/geocode`.

### Social Media Integration

The application can automatically post generated reports to social media platforms:

- **Twitter**: Uses `TwitterService` (`src/lib/twitter-service.ts`) to post reports as threaded tweets. It handles OAuth 2.0 for authentication, storing tokens in a Cloudflare KV namespace (`AUTH_TOKENS`).
- **Instagram**: Uses `InstagramService` (`src/lib/instagram-service.ts`) to post reports to an Instagram Business account. This includes dynamically generated images with the report headline overlaid and a caption with the full report details.
- **Facebook**: Uses `FacebookService` (`src/lib/facebook-service.ts`) to post reports to a Facebook Page. Posts include the full report content with hashtags and links.

#### Instagram Image Generation Process

The Instagram service uses a modern, integrated approach for image generation:

1. **HTML Generation**: Creates styled HTML directly in the service with the report headline
2. **Screenshot Generation**: Uses Cloudflare's Browser Rendering API to capture a 1080x1080 JPEG screenshot
3. **R2 Storage**: Stores the generated image in Cloudflare R2 bucket with 7-day retention
4. **Instagram Posting**: Uses the R2 public URL to post the image with caption to Instagram

**Automation Note**: Social media posting is automatically triggered as part of the report generation process, which runs on a schedule (see Scheduled Tasks below) and can also be manually triggered.

### Scheduled Tasks (Cron Jobs)

The application utilizes Cloudflare Workers' scheduled events (cron jobs) for background tasks, managed in `src/lib/cron.ts`. The `wrangler.toml` file defines the specific cron patterns:

- **Hourly Message Updates**: Fetches new messages from Discord channels. Triggered by the cron pattern `"0 * * * *"` (at the start of every hour).
- **Hourly Report Generation & Social Media Posting**: Generates fresh news reports from collected messages and subsequently posts the top report to Twitter, Instagram, and Facebook. Triggered by the cron pattern `"2 * * * *"` (at 2 minutes past every hour).
- **Manual Triggers**: The cron handler also supports specific string identifiers (e.g., `MESSAGES`, `REPORTS_2H`) for on-demand triggering of these tasks, likely via direct Worker invocation or other scheduled configurations.

### Caching

The application leverages Cloudflare KV for caching various types of data to improve performance and reduce API calls. A `CacheManager` utility (`src/lib/cache-utils.ts`) provides a consistent interface for interacting with KV namespaces, supporting TTL-based expiration and background refresh (stale-while-revalidate) strategies.

Key KV namespaces used (defined in `wrangler.toml`):

- `EXECUTIVE_ORDERS_CACHE`: Caches individual executive orders and ID lookups.
- `REPORTS_CACHE`: Caches generated news reports.
- `CHANNELS_CACHE`: Caches filtered lists of Discord channels.
- `MESSAGES_CACHE`: Caches messages fetched from Discord channels.
- `SUBSCRIPTIONS_CACHE`: Caches Stripe subscription data.
- `AUTH_TOKENS`: Stores OAuth tokens for Twitter API access.
- `GEOCODE_CACHE`: Caches geocoding results for News Globe.
- `FEEDS_CACHE`: Caches RSS feed data for Brazil News.

Key R2 buckets used (defined in `wrangler.toml`):

- `INSTAGRAM_IMAGES`: Stores generated Instagram post images with automatic 7-day cleanup.
