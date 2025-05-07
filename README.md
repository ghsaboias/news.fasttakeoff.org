# Fast Takeoff News

A Next.js application aggregating executive orders from the Federal Register API and generating real-time reports from Discord channel messages. Written in TypeScript, it uses Tailwind CSS for styling, Radix UI for components, and deploys via Cloudflare Workers with KV caching. I patched the Cloudflare Worker to expose a _scheduled_ route in order to trigger report generation with cron jobs. I use open-next to adapt the Next.js build for Cloudflare's runtime.

## Overview

- **Purpose**: Fetch and display executive orders, monitor Discord channels for bot activity and generate structured reports using a configurable AI provider (currently Gemini 2.5 Flash via OpenRouter).
- **Deployment**: Hosted at news.fasttakeoff.org via Cloudflare Workers.
- **Key Integrations**: Federal Register API, Discord API, configurable AI Provider (e.g., Groq, OpenRouter), Clerk for authentication, Stripe for subscriptions, Twitter API, Instagram Graph API.

## Technical Details

- **Framework**: Next.js 15.2.2 (React 19.0.0)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x with custom theming (src/app/globals.css), shadcn/ui components
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
- **Dependencies**: groq-sdk, lucide-react, class-variance-authority, full list in package.json
- **Configuration**: ESLint (eslint.config.mjs), PostCSS (postcss.config.mjs), TypeScript (tsconfig.json)

### Data Management and Transformation

The application's core data handling is managed by services and transformers within the `src/lib/` directory:

- **`src/lib/data/channels-service.ts` (`ChannelsService`)**: Fetches Discord channels from the API, filters them based on criteria (type, emoji prefix, permissions), and caches the results. Essential for identifying relevant channels for news monitoring.
- **`src/lib/data/messages-service.ts` (`MessagesService`)**: Responsible for fetching messages from specified Discord channels, handling pagination, and caching them. Provides the raw source material for report generation.
- **`src/lib/data/executive-orders.ts`**: Fetches lists of executive orders and individual order details from the Federal Register API. Implements caching for individual orders and mechanisms to look up orders by number.
- **`src/lib/data/reports-service.ts` (`ReportsService`)**: Orchestrates the generation of news reports. It retrieves messages, prepares prompts for the AI, calls the AI provider, processes the response, and caches the generated reports. It also triggers social media posting.
- **`src/lib/transformers/executive-orders.ts`**: Transforms raw executive order data fetched from the Federal Register API into a structured `ExecutiveOrder` type used throughout the application, simplifying data handling in the frontend and other services.

### Common Utilities & API Helpers

- **`src/lib/utils.ts`**: Provides a collection of general utility functions for tasks such as date/time formatting and manipulation (e.g., `formatDate`, `formatTime`, `getStartDate`), parsing specific text formats (e.g., `parseDispositionNotes` for executive order relations), class name construction for Tailwind CSS (`cn`), and accessing the Cloudflare Worker environment context (`getCacheContext`).
- **`src/lib/api-utils.ts`**: Offers helpers for Next.js API routes, including a `withErrorHandling` higher-order function to standardize error responses and JSON formatting, and default cache headers (`API_CACHE_HEADERS`) for API responses.

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
│   ├── NewsGlobe.tsx     # 3D interactive news globe component
│   ├── Header.tsx        # Application header with navigation and user auth
│   ├── Footer.tsx        # Application footer
│   └── ui/               # shadcn/ui components (e.g., button.tsx)
├── lib/                  # Utilities and data logic
│   ├── data/             # API clients (e.g., discord-channels.ts)
│   ├── transformers/     # Data transformation (e.g., executive-orders.ts)
│   └── types/            # TypeScript interfaces (e.g., core.ts)
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
  # For Stripe redirects, ensure this matches your deployment or local setup
  SERVER_API_URL=https://news.fasttakeoff.org # (Production URL, override with http://localhost:8787 for local Cloudflare Worker dev)
  # Twitter Integration (for posting reports)
  TWITTER_CLIENT_ID=<your-twitter-app-client-id>
  TWITTER_CLIENT_SECRET=<your-twitter-app-client-secret>
  # Note: Twitter integration also requires an 'AUTH_TOKENS' KV namespace in Cloudflare for storing OAuth tokens.
  # Instagram Integration (for posting reports)
  INSTAGRAM_ACCESS_TOKEN=<your-instagram-long-lived-access-token>
  INSTAGRAM_ACCOUNT_ID=<your-instagram-account-id> # (Currently hardcoded in instagram-service.ts but should be env var)

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

- **/api/reports**: Generates reports from Discord messages via Groq API; GET fetches cached summaries.
- **/api/channels**: Retrieves guild channels.
- **/api/geocode**: Geocodes a city name (used by News Globe).
- **/api/stripe/checkout**: Initiates a Stripe checkout session for subscriptions.
- **/api/stripe/webhook**: Handles incoming Stripe webhook events (e.g., `checkout.session.completed`).

### Frontend:

- **/current-events**: Displays active channels with message previews and report generation.
- **/executive-orders**: Lists and details executive orders with pagination and search.
- **/news-globe**: Shows an interactive 3D globe with geolocated news reports.
- **/profile**: User profile page, shows subscription status and allows users to subscribe.
- **/sign-in**: User sign-in page (Clerk).
- **/sign-up**: User sign-up page (Clerk).
- **/privacy-policy**: Application's privacy policy.
- **/**: Home page featuring an animated hero section, and previews of the latest news reports and executive orders. This page is client-rendered and fetches its data on the client side.

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

The AI provider for report generation is configurable via `src/lib/config.ts` (defaulting to OpenRouter with Gemini 2.5 Flash).

### News Globe

A new interactive feature that displays news reports as markers on a 3D globe. It fetches report data, geocodes the associated city, and visualizes it.

- **Technology**: Uses `@react-three/fiber` and `@react-three/drei` for 3D rendering.
- **Data Sources**: News reports from `/api/reports`, geocoding via `/api/geocode`.

### Social Media Integration

The application can automatically post generated reports to social media platforms:

- **Twitter**: Uses `TwitterService` (`src/lib/twitter-service.ts`) to post reports as tweets. It handles OAuth 2.0 for authentication, storing tokens in a Cloudflare KV namespace (`AUTH_TOKENS`).
- **Instagram**: Uses `InstagramService` (`src/lib/instagram-service.ts`) to post reports to an Instagram Business account. This includes an image and a caption.

**Automation Note**: Social media posting is automatically triggered as part of the report generation process, which runs on a schedule (see Scheduled Tasks below) and can also be manually triggered.

### Scheduled Tasks (Cron Jobs)

The application utilizes Cloudflare Workers' scheduled events (cron jobs) for background tasks, managed in `src/lib/cron.ts`. The `wrangler.toml` file defines the specific cron patterns:

- **Hourly Message Updates**: Fetches new messages from Discord channels. Triggered by the cron pattern `"0 * * * *"` (at the start of every hour).
- **Hourly Report Generation & Social Media Posting**: Generates fresh news reports from collected messages and subsequently posts the top report to Twitter and Instagram. Triggered by the cron pattern `"2 * * * *"` (at 2 minutes past every hour).
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

## License

MIT

### Cloudflare Worker Configuration (`wrangler.toml`)

Key configurations in `wrangler.toml` include:

- **Cron Triggers**: Defines schedules for automated tasks (e.g., `"0 * * * *"`, `"2 * * * *"`).
- **KV Namespaces**: Bindings for data storage:
  - `EXECUTIVE_ORDERS_CACHE`
  - `REPORTS_CACHE`
  - `CHANNELS_CACHE`
  - `MESSAGES_CACHE`
  - `SUBSCRIPTIONS_CACHE` (for Stripe subscription data)
  - `AUTH_TOKENS` (crucial for Twitter OAuth token storage)
- **Environment Variables**: Production values for public URLs and Clerk keys are often set here.
