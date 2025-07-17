# Codebase Directory Tree

```
- app/
  - api/
    - channels/
      - route.ts
    - emails/
      - route.ts
    - entities/
      - extract/
        - route.ts
      - route.ts
    - executive-orders/
      - route.ts
    - expired/
      - route.ts
    - fact-check/
      - route.ts
    - geo/
      - route.ts
    - geocode/
      - route.ts
    - images/
      - route.ts
    - link-preview/
      - route.ts
    - messages/
      - heatmap/
        - route.ts
      - route.ts
    - oembed/
      - twitter/
        - route.ts
    - prompt-test/
      - route.ts
    - reports/
      - route.ts
    - rss/
      - [feedId]/
        - route.ts
      - route.ts
    - source-attribution/
      - route.ts
    - stripe/
      - checkout/
        - route.ts
      - webhook/
        - route.ts
      - .DS_Store
    - summaries/
      - [key]/
        - route.ts
      - list/
        - route.ts
    - summarize/
      - route.ts
    - test-ai-image/
    - test-twitter/
      - route.ts
    - translate/
      - route.ts
    - trigger-cron/
      - route.ts
    - twitter-usage/
    - .DS_Store
    - .repomix-output.txt
  - brazil/
    - SummaryDisplay.tsx
    - page.tsx
  - current-events/
    - [channelId]/
      - [reportId]/
        - ReportClient.tsx
        - page.tsx
      - messages/
        - MessagesClient.tsx
        - page.tsx
      - .DS_Store
      - ChannelDetailClient.tsx
      - page.tsx
    - .DS_Store
    - CurrentEventsClient.tsx
    - page.tsx
  - entities/
    - graph/
      - EntityGraphClient.tsx
      - page.tsx
    - EntitiesClient.tsx
    - page.tsx
  - executive-orders/
    - [id]/
      - ExecutiveOrderClient.tsx
      - page.tsx
    - .DS_Store
    - ExecutiveOrdersClient.tsx
    - page.tsx
  - message-activity/
    - page.tsx
  - news-globe/
    - NewsGlobeClient.tsx
    - page.tsx
  - news-sitemap.xml/
    - route.ts
  - power-network/
    - NetworkVisualization.tsx
    - page.tsx
  - privacy-policy/
    - page.tsx
  - profile/
    - page.tsx
  - rss/
    - route.ts
  - sign-in/
    - [[...sign-in]]/
      - page.tsx
    - .DS_Store
  - sign-up/
    - [[...sign-up]]/
      - page.tsx
    - .DS_Store
  - sitemap-index.xml/
    - route.ts
  - sitemap.xml/
    - route.ts
  - .DS_Store
  - layout.tsx
  - metadata.ts
  - not-found.tsx
  - page.tsx
- components/
  - analytics/
    - ThirdPartyScripts.tsx
  - auth/
    - AuthProvider.tsx
  - current-events/
    - timeline/
      - MessageItemTimeline.tsx
      - MessageTimeline.tsx
    - EntityDisplay.tsx
    - FactCheckDisplay.tsx
    - LinkBadge.tsx
    - LinkPreview.tsx
    - MediaPreview.tsx
    - MessageItem.tsx
    - ReportCard.tsx
    - TelegramEmbed.tsx
    - TranslationBadge.tsx
    - TweetEmbed.tsx
  - executive-orders/
    - OrderCard.tsx
  - power-network/
  - skeletons/
    - ReportCardSkeleton.tsx
  - source-attribution/
    - AttributedReportViewer.tsx
    - InteractiveReportBody.tsx
    - SourceTooltip.tsx
    - index.ts
  - ui/
    - accordion.tsx
    - badge.tsx
    - button.tsx
    - card.tsx
    - dialog.tsx
    - dropdown-menu.tsx
    - input.tsx
    - loader.tsx
    - pagination.tsx
    - popover.tsx
    - select.tsx
    - separator.tsx
    - sheet.tsx
    - tabs.tsx
    - tooltip.tsx
  - utils/
    - ClientOnly.tsx
    - LocalDateTime.tsx
  - .DS_Store
  - Footer.tsx
  - Header.tsx
  - HomeContent.tsx
  - MessageHeatmap.tsx
  - NewsGlobe.tsx
  - ReportPanel.tsx
  - RootLayoutClient.tsx
- lib/
  - data/
    - channels-service.ts
    - executive-orders.ts
    - feeds-service.ts
    - messages-service.ts
    - report-service.ts
    - rss-service.ts
    - sitemap-service.ts
  - hooks/
    - index.ts
    - useApi.ts
    - useBasicForceSimulation.ts
    - useCanvasCamera.ts
    - useEntityRelevance.ts
    - useFilters.ts
    - useForceSimulation.ts
    - useGeolocation.ts
    - useGraphData.ts
    - useMobileBreakpoint.ts
    - useNetworkRenderer.ts
    - useNodeSelection.ts
    - useNodes.ts
  - seo/
    - ping-search-engines.ts
  - transformers/
    - executive-orders.ts
  - types/
    - api.ts
    - core.ts
    - executive-orders.ts
  - utils/
    - source-attribution/
      - index.ts
      - source-attribution-ai.ts
      - source-attribution-service.ts
    - entity-cache.ts
    - entity-extraction.ts
    - entity-relevance-scorer.ts
    - fact-check-service.ts
    - image-service.ts
    - message-filter-service.ts
    - report-ai.ts
    - report-cache.ts
    - report-utils.ts
    - twitter-utils.ts
  - .DS_Store
  - ai-config.ts
  - api-utils.ts
  - cache-utils.ts
  - clerkUtils.ts
  - config.ts
  - cron.ts
  - facebook-service.ts
  - instagram-service.ts
  - twitter-service.ts
  - utils.ts
- .DS_Store
- middleware.ts
```

# Config File Skeletons

## wrangler.toml

```toml
main = ".open-next/worker.js"
name = "news-fasttakeoff-org"
compatibility_date = "2025-03-11"
compatibility_flags = [
    "nodejs_compat",
]

[triggers]
# Cron list:
# - "0 * * * *"   → top of every hour: messages → reports → feeds (in-process ordering)
# - "*/5 * * * *" → every 5 minutes (skip 0): messages cache refresh
crons = ["0 * * * *", "5/5 * * * *"]

[assets]
directory = ".open-next/assets"
```

## package.json

```json
{
  "name": "news.fasttakeoff.org",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "dev:clean": "rm -rf .wrangler/state && next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "preview": "opennextjs-cloudflare build && wrangler dev",
    "preview:patch": "opennextjs-cloudflare build && node patch-worker.js",
    "preview:patch:test": "opennextjs-cloudflare build && node patch-worker.js && wrangler dev --test-scheduled",
    "preview:patch:test:clean": "rm -rf .wrangler/state && opennextjs-cloudflare build && node patch-worker.js && wrangler dev --test-scheduled",
    "deploy": "opennextjs-cloudflare build && node patch-worker.js && wrangler deploy",
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
```

## next.config.ts

```ts
import type { NextConfig } from "next";

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
```

## tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
          hover: "var(--primary-hover)",
          light: "var(--primary-light)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
```

# Source File Dense AST Skeletons

## src/app/api/channels/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/channels-service
/**
GET /api/channels
Fetches a list of Discord channels with metadata.
@returns {Promise<NextResponse<DiscordChannel[]>>} - Array of channel objects.
@throws 500 if there is an error fetching channels.
@auth None required.
*/
export function GET(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/emails/route.ts

```typescript
Imports: @/lib/utils, next/server
/**
POST /api/emails
Subscribes a user to email updates.
@param request - NextRequest with JSON body: { email: string }
@returns {Promise<NextResponse<{ message: string; id: number } | { error: string }>>}
@throws 400 if email is missing/invalid, 409 if already subscribed, 500 for server/database errors.
@auth None required.

GET /api/emails
Retrieves up to 100 recent email subscriptions (admin use).
@returns {Promise<NextResponse<{ emails: Array<{ id: number; email: string; subscribed_at: string; status: string }>; count: number } | { error: string }>>}
@throws 500 if database is unavailable or query fails.
@auth None required.
*/
export function POST(request: NextRequest): Promise<NextResponse<{ error: string; }> | NextResponse<{ message: string; id: number; }>>
export function GET(): Promise<NextResponse<{ error: string; }> | NextResponse<{ emails: Record<string, unknown>[]; count: number; }>>
```

## src/app/api/entities/extract/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/report-service, @/lib/types/core, @/lib/utils, @/lib/utils/entity-extraction, next/server
/**
POST /api/entities/extract
Triggers entity extraction for the latest batch of reports that lack entity data.
@returns {Promise<NextResponse<{ message: string; total: number; successful: number; failed: number } | { message: string; processed: 0 }>>}
@throws 500 if extraction fails or no eligible reports are found.
@auth None required.
@integration Uses ReportService and EntityExtractor for batch processing.
*/
export function POST(): Promise<NextResponse<unknown>>
```

## src/app/api/entities/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/report-service, @/lib/types/core, @/lib/utils/entity-extraction, next/server
export function POST(request: Request): Promise<NextResponse<unknown>>
export function GET(request: Request): Promise<NextResponse<unknown>>
```

## src/app/api/executive-orders/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/executive-orders, @/lib/utils
/**
GET /api/executive-orders
Fetches the 3 most recent executive orders from the Federal Register.
@returns {Promise<NextResponse<ExecutiveOrder[]>>}
@throws 500 if fetching or sorting fails.
@auth None required.
*/
export function GET(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/expired/route.ts

```typescript
Imports: next / server;
export function GET(): Promise<NextResponse<unknown>>;
```

## src/app/api/fact-check/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/cache-utils, @/lib/data/report-service, @/lib/types/core, @/lib/utils/fact-check-service, next/server
/**
GET /api/fact-check
Retrieves a fact-check result for a specific report.
@param request - Query param: reportId (string, required)
@returns {Promise<NextResponse<FactCheckResult | { error: string }>>}
@throws 400 if reportId is missing, 500 for server/cache errors.

POST /api/fact-check
Triggers on-demand fact-checking for a report.
@param request - JSON body: { reportId: string }
@returns {Promise<NextResponse<FactCheckResult | { error: string }>>}
@throws 400 if reportId is missing, 404 if report not found, 408 for timeout, 500 for errors.
@auth None required.
@integration Uses PerplexityFactCheckService and ReportService.
*/
export function GET(request: NextRequest): Promise<NextResponse<unknown>>
export function POST(request: NextRequest): Promise<NextResponse<unknown>>
```

## src/app/api/geo/route.ts

```typescript
Imports: next/server
export dynamic = 'force-dynamic'
/**
GET /api/geo
Returns the user's country code based on the Cloudflare CF-IPCountry header.
@returns {Promise<NextResponse<{ country: string } | { message: string; error: string }>>}
@throws 500 if header is missing or an error occurs.
@auth None required.
*/
export function GET(request: NextRequest): Promise<NextResponse<{ country: string; }> | NextResponse<{ message: string; error: string; }>>
```

## src/app/api/geocode/route.ts

```typescript
Imports: next/server, ../../../../worker-configuration, ../../../lib/cache-utils, ../../../lib/utils
export function GET(request: Request): Promise<NextResponse<{ error: string; }> | NextResponse<GoogleGeocodeLocation>>
```

## src/app/api/images/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/utils/image-service, next/server
/**
POST /api/images
Generates a PNG image for a given news headline.
@param request - JSON body: { headline: string }
@returns {Promise<NextResponse<Buffer> | NextResponse<{ error: string }>>}
@throws 400 if headline is missing/invalid, 500 for image generation errors.
@auth None required.
@integration Uses ImageService.
*/
export function POST(request: NextRequest): Promise<NextResponse<unknown>>
```

## src/app/api/link-preview/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/cache-utils
/**
GET /api/link-preview
Fetches and caches Open Graph/meta preview data for a given URL.
@param request - Query param: url (string, required)
@returns {Promise<LinkPreview | { error: string }>}
@throws 400 if url is missing/invalid, 500 for fetch/parse errors.
@auth None required.
@integration Uses CacheManager for 24h caching.
*/
export function GET(request: Request): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/messages/heatmap/route.ts

```typescript
Imports: @/lib/cache-utils, @/lib/data/channels-service, @/lib/types/core, @/lib/utils, next/server
export function GET(): Promise<NextResponse<{ error: string; }> | NextResponse<HeatmapResponse>>
```

## src/app/api/messages/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/channels-service
/**
GET /api/messages
Fetches details and messages for a specific Discord channel.
@param request - Query param: channelId (string, required)
@returns {Promise<NextResponse<{ channel: DiscordChannel | null; messages: { count: number; messages: DiscordMessage[] } } | { error: string }>>}
@throws 400 if channelId is missing, 500 for server errors.
@auth None required.
*/
export function GET(request: Request): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/oembed/twitter/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/cache-utils, @/lib/types/core, @/lib/utils/twitter-utils
export function GET(request: Request): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/prompt-test/route.ts

```typescript
Imports: @/lib/ai-config, @/lib/config, @/lib/data/channels-service, @/lib/data/messages-service, @/lib/types/core, fs, next/server, path, uuid, ../../../../worker-configuration
export function GET(request: Request): Promise<NextResponse<{ channels: import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/src/lib/types/core").DiscordChannel[]; }> | NextResponse<{ sets: { id: any; channel: any; messages: any; created: any; }[]; }> | NextResponse<{ error: string; }>>
export function POST(request: Request): Promise<NextResponse<{ error: string; }> | NextResponse<{ testSet: { id: string; created_at: string; messages: DiscordMessage[]; metadata: { channelId: any; channelName: string; timeframe: any; messageCount: number; timeRange: { start: string; end: string; }; }; }; }> | NextResponse<{ result: Report; }>>
```

## src/app/api/reports/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/cache-utils, @/lib/config, @/lib/data/report-service, @/lib/types/core, next/server
/**
GET /api/reports
Fetches reports and associated messages for a channel or all channels.
@param request - Query params: channelId (optional), reportId (optional), limit (optional)
@returns {Promise<NextResponse<ReportResponse | Report[] | { error: string }>>}
@throws 404 if report not found, 500 for errors.

POST /api/reports
Generates a new report for a channel and timeframe.
@param request - JSON body: { channelId: string, timeframe?: '2h'|'6h', model?: string }
@returns {Promise<{ report: Report, messages: DiscordMessage[] } | { error: string }>}
@throws 400 if channelId is missing, 500 for errors.
@auth None required.
@integration Uses ReportService, CacheManager.
*/
export function GET(request: NextRequest): Promise<NextResponse<unknown>>
export function POST(request: Request): Promise<NextResponse<unknown>>
```

## src/app/api/rss/[feedId]/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/rss-service
/**
GET /api/rss/[feedId]
Fetches items from a specific RSS feed.
@param request - Path param: feedId (string, required)
@returns {Promise<NextResponse<FeedItem[] | { error: string }>>}
@throws 400 if feedId is missing, 500 for fetch errors.
@auth None required.
@integration Uses getFeedItems from rss-service.
*/
export function GET(request: Request, { params }: { params: Promise<{ feedId: string }> }): Promise<Response>
```

## src/app/api/rss/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/config
/**
GET /api/rss
Lists available RSS feed sources for news aggregation.
@returns {Promise<NextResponse<{ id: string; url: string }[]>>}
@throws 500 for errors.
@auth None required.
*/
export function GET(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/source-attribution/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/report-service, @/lib/utils/source-attribution, ../../../../worker-configuration
/**
GET /api/source-attribution
Retrieves source attributions for a report, mapping report sentences to source messages.
@param request - Query params: reportId (string, required), channelId (string, required)
@returns {Promise<ReportSourceAttribution | { error: string }>}
@throws 400 if params are missing, 404 if report not found, 500 for errors.
@auth None required.
@integration Uses ReportService, SourceAttributionService.
*/
export function GET(request: Request): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/stripe/checkout/route.ts

```typescript
Imports: @clerk/nextjs/server, next/server
/**
POST /api/stripe/checkout
Creates a Stripe checkout session for a user subscription.
@param request - JSON body: { userId: string }
@returns {Promise<NextResponse<{ url: string } | { error: string }>>}
@throws 400 if userId is missing, 404 if user not found, 500 for Stripe/server errors.
@auth Requires valid Clerk userId.
@integration Uses Stripe API, Clerk.
*/
export function POST(req: Request): Promise<NextResponse<{ error: any; }> | NextResponse<{ url: any; }>>
```

## src/app/api/stripe/webhook/route.ts

```typescript
Imports: next/server, stripe
export function POST(req: Request): Promise<NextResponse<{ received: boolean; }> | NextResponse<{ error: string; }>>
export config = {
    api: {
        bodyParser: false,
    },
}
export dynamic = 'force-dynamic'
```

## src/app/api/summaries/[key]/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/data/feeds-service
/**
GET /api/summaries/[key]
Fetches a cached news summary for a specific key.
@param request - Path param: key (string, required)
@returns {Promise<NextResponse<SummaryResult | { error: string }>>}
@throws 400 if key is missing, 404 if summary not found, 500 for errors.
@auth None required.
@integration Uses FeedsService.
*/
export function GET(request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response>
```

## src/app/api/summaries/list/route.ts

```typescript
Imports: @/lib/data/feeds-service, @/lib/utils, next/server
/**
GET /api/summaries/list
Lists available cached news summaries (keys and creation dates).
@returns {Promise<NextResponse<{ key: string; createdAt: string }[] | { error: string }>>}
@throws 500 for errors.
@auth None required.
@integration Uses FeedsService.
*/
export function GET(): Promise<NextResponse<{ key: string; createdAt: string; }[]> | NextResponse<{ error: string; }>>
```

## src/app/api/summarize/route.ts

```typescript
Imports: @/lib/ai-config, @/lib/data/feeds-service, @/lib/types/core, @/lib/utils, next/server
export function POST(req: Request): Promise<NextResponse<{ error: string; }> | NextResponse<{ summary: string; }>>
export function GET(): Promise<NextResponse<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/src/lib/types/core").SummaryResult> | NextResponse<{ error: string; }>>
```

## src/app/api/test-twitter/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/twitter-service, @/lib/types/core
export function POST(request: Request): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/next/server").NextResponse<unknown>>
```

## src/app/api/translate/route.ts

```typescript
Imports: @/lib/ai-config, next/server
/**
POST /api/translate
Translates a news report or content fields to a target language using an AI provider.
@param request - JSON body: { headline?: string, city?: string, body: string, targetLang: string }
@returns {Promise<NextResponse<{ translatedContent: TranslationResponse } | { error: string }>>}
@throws 400 if required fields are missing, 500 for errors.
@auth None required.
@integration Uses AI provider for translation.
*/
export function POST(req: Request): Promise<NextResponse<{ error: string; }> | NextResponse<{ translatedContent: TranslationResponse; }>>
```

## src/app/api/trigger-cron/route.ts

```typescript
Imports: @/lib/api-utils, @/lib/cron, next/server
export function POST(request: Request): Promise<NextResponse<unknown>>
```

## src/app/brazil/SummaryDisplay.tsx

```typescript
Imports: @/components/ui/loader, @/components/ui/select, @/components/utils/LocalDateTime, @/lib/hooks, @/lib/types/core, react, react-markdown
export function SummaryDisplay(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/app/brazil/page.tsx

```typescript
Imports: ./SummaryDisplay
export revalidate = 3600
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; }>
export function BRNewsPage(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/current-events/CurrentEventsClient.tsx

```typescript
Imports: @/components/current-events/ReportCard, @/components/ui/badge, @/components/ui/button, @/components/ui/input, @/components/ui/loader, @/components/ui/select, @/lib/hooks, @/lib/types/core, lucide-react, react
export interface Props {  reports: Report[];  isLoading?: boolean;
}
export function CurrentEventsClient({ reports: initialReports, isLoading = false }: Props): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/current-events/[channelId]/ChannelDetailClient.tsx

```typescript
Imports: @/components/current-events/ReportCard, @/components/ui/button, @/lib/types/core, lucide-react, next/link, next/navigation, react
export function ChannelDetailClient({ reports, channel }: { reports: Report[]; channel: DiscordChannel | null }): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/current-events/[channelId]/[reportId]/ReportClient.tsx

```typescript
Imports: @/app/not-found, @/components/current-events/FactCheckDisplay, @/components/current-events/MessageItem, @/components/source-attribution, @/components/ui/button, @/components/ui/dropdown-menu, @/components/ui/loader, @/components/utils/LocalDateTime, @/lib/hooks, @/lib/types/core, lucide-react, next/link, next/navigation, react, react-masonry-css, sonner
export function ReportClient(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/current-events/[channelId]/[reportId]/page.tsx

```typescript
Imports: @/lib/data/channels-service, @/lib/data/report-service, @/lib/utils, next/navigation, ./ReportClient
export revalidate = 300
export function generateStaticParams(): Promise<{ channelId: string; reportId: string; }[]>
export function generateMetadata({ params }: { params: Promise<{ channelId: string, reportId: string }> }): Promise<{ title: string; description: string; alternates: { canonical: string; }; robots?: undefined; openGraph?: undefined; twitter?: undefined; keywords?: undefined; } | { title: string; description: string; robots: { index: boolean; follow: boolean; }; alternates: { canonical: string; }; openGraph?: undefined; twitter?: undefined; keywords?: undefined; } | { title: string; description: string; alternates: { canonical: string; }; robots: { index: boolean; follow: boolean; }; openGraph: { title: string; description: string; type: string; publishedTime: string; section: string; images: { url: string; width: number; height: number; alt: string; }[]; }; twitter: { card: string; title: string; description: string; images: { url: string; width: number; height: number; alt: string; type: string; }[]; }; keywords: string; }>
export function ReportDetailPage({ params }: { params: Promise<{ channelId: string, reportId: string }> }): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/current-events/[channelId]/messages/MessagesClient.tsx

```typescript
Imports: @/components/current-events/timeline/MessageTimeline, @/components/ui/button, @/components/ui/loader, @/lib/types/core, lucide-react, next/link, react
export function MessagesClient({
    channelId
}: MessagesClientProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/current-events/[channelId]/messages/page.tsx

```typescript
Imports: ./MessagesClient
export function generateMetadata({ params }: PageProps): Promise<{ title: string; description: string; alternates: { canonical: string; }; robots: { index: boolean; follow: boolean; }; }>
export function MessagesPage({ params }: PageProps): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/current-events/[channelId]/page.tsx

```typescript
Imports: @/lib/data/channels-service, @/lib/data/report-service, @/lib/types/core, @/lib/utils, next/navigation, ./ChannelDetailClient
export revalidate = 600
export function generateStaticParams(): Promise<{ channelId: string; }[]>
export function generateMetadata({ params }: { params: Promise<{ channelId: string }> }): Promise<{ title: string; description: string; alternates: { canonical: string; }; robots?: undefined; openGraph?: undefined; twitter?: undefined; } | { title: string; description: string; alternates: { canonical: string; }; robots: { index: boolean; follow: boolean; }; openGraph: { title: string; description: string; type: string; images: { url: string; width: number; height: number; alt: string; }[]; }; twitter: { card: string; title: string; description: string; images: { url: string; width: number; height: number; alt: string; type: string; }[]; }; }>
export function ChannelDetailPage({ params }: { params: Promise<{ channelId: string }> }): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/current-events/page.tsx

```typescript
Imports: @/lib/data/report-service, @/lib/utils, ./CurrentEventsClient
export revalidate = 300
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; openGraph: { title: string; description: string; type: string; images: { url: string; width: number; height: number; alt: string; }[]; }; twitter: { card: string; title: string; description: string; images: { url: string; width: number; height: number; alt: string; type: string; }[]; }; }>
export function CurrentEventsPage(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/entities/EntitiesClient.tsx

```typescript
Imports: @/components/ui/badge, @/components/ui/button, @/components/ui/card, @/components/ui/input, @/components/ui/loader, @/components/ui/select, @/lib/types/core, lucide-react, next/link, react
export function EntitiesClient(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/entities/graph/EntityGraphClient.tsx

```typescript
Imports: @/components/ui/loader, @/lib/config, @/lib/hooks, @/lib/types/core, next/image, next/link, react, ../../../lib/hooks
export function EntityGraphClient(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/entities/graph/page.tsx

```typescript
Imports: next, ./EntityGraphClient
export metadata: Metadata = {
    title: 'Entity Graph - Fast Takeoff',
    description: 'Interactive visualization of entities and their connections from news reports.',
    keywords: 'entity graph, news analysis, data visualization, connected entities',
}
export function EntityGraphPage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/entities/page.tsx

```typescript
Imports: next, ./EntitiesClient
export metadata: Metadata = {
    title: 'Entities - Fast Takeoff',
    description: 'Explore key entities mentioned in news reports',
    keywords: 'entities, people, organizations, locations, news analysis',
}
export function EntitiesPage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/executive-orders/ExecutiveOrdersClient.tsx

```typescript
Imports: @/components/executive-orders/OrderCard, @/components/ui/button, @/components/ui/input, @/components/ui/loader, @/components/ui/separator, @/lib/data/executive-orders, @/lib/hooks, @/lib/types/core, @/lib/utils, react
export function ClientExecutiveOrders({ initialOrders }: { initialOrders: ExecutiveOrder[] }): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/executive-orders/[id]/ExecutiveOrderClient.tsx

```typescript
Imports: @/components/ui/button, @/components/ui/loader, @/lib/data/executive-orders, @/lib/types/core, @/lib/utils, lucide-react, next/link, next/navigation, react, react-markdown
export function ExecutiveOrderClient({
    initialOrder,
}: {
    initialOrder: ExecutiveOrder;
}): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/app/executive-orders/[id]/page.tsx

```typescript
Imports: @/lib/data/executive-orders, @/lib/utils, next/navigation, ./ExecutiveOrderClient
export function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<{ title: string; description: string; alternates: { canonical: string; }; robots: { index: boolean; follow: boolean; }; }>
export function ExecutiveOrderPage({ params }: { params: Promise<{ id: string }> }): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/executive-orders/page.tsx

```typescript
Imports: @/lib/data/executive-orders, @/lib/utils, ./ExecutiveOrdersClient
export revalidate = 3600
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; }>
export function ExecutiveOrdersPage(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/layout.tsx

```typescript
Imports: @/components/RootLayoutClient, @/components/analytics/ThirdPartyScripts, next/font/google, ./critical.css, ./globals.css, ./metadata
export function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/message-activity/page.tsx

```typescript
Imports: @/components/MessageHeatmap, react
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; }>
export function MessageActivityPage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/metadata.ts

```typescript
Imports: next
export metadata: Metadata = {
    title: 'Fast Takeoff News',
    description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
    icons: {
        icon: [
            { url: '/favicon.ico', type: 'image/x-icon', sizes: '32x32' },
        ],
        apple: '/images/brain-180.webp',
    },
    openGraph: {
        title: 'Fast Takeoff News',
        description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
        url: 'https://news.fasttakeoff.org',
        siteName: 'Fast Takeoff News',
        images: [
            {
                url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
                width: 1200,
                height: 630,
                alt: 'Fast Takeoff News - AI-powered news for everyone',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Fast Takeoff News',
        description: 'AI-powered news for everyone. Get the latest news from on-the-ground sources.',
        images: [{
            url: 'https://news.fasttakeoff.org/images/og-screenshot.webp',
            width: 1200,
            height: 630,
            alt: 'Fast Takeoff News - AI-powered news for everyone',
            type: 'image/webp',
        }],
        creator: '@fasttakeoff',
        site: '@fasttakeoff',
    },
}
```

## src/app/news-globe/NewsGlobeClient.tsx

```typescript
Imports: next / dynamic, react;
export function NewsGlobeClient(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element;
```

## src/app/news-globe/page.tsx

```typescript
Imports: ./NewsGlobeClient
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; }>
export function NewsGlobePage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/news-sitemap.xml/route.ts

```typescript
Imports: @/lib/data/channels-service, @/lib/data/report-service, @/lib/utils
export function GET(): Promise<Response>
```

## src/app/not-found.tsx

```typescript
Imports: @/components/ui/button, @/components/ui/card, @/components/ui/separator, next/link
export function NotFound(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/page.tsx

```typescript
Imports: @/components/HomeContent, @/lib/cache-utils, @/lib/data/report-service, @/lib/types/core, @/lib/utils, react
export revalidate = 180
export dynamic = 'force-dynamic'
export function generateMetadata(): Promise<{ title: string; description: string; alternates: { canonical: string; }; }>
export function Home(): Promise<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element>
```

## src/app/power-network/NetworkVisualization.tsx

```typescript
Imports: next/image, next/link, react, ../../components/ui/sheet, ../../lib/hooks, ../../lib/hooks/useBasicForceSimulation, ../../lib/hooks/useEntityRelevance
export function NetworkVisualization(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/power-network/page.tsx

```typescript
Imports: next, ./NetworkVisualization
export metadata: Metadata = {
    title: 'Power Network - Fast Takeoff',
    description: 'Interactive visualization of influential people, companies, and funds shaping the global economy',
    keywords: 'power network, influence mapping, tech leaders, venture capital, business connections',
}
export function PowerNetworkPage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/privacy-policy/page.tsx

```typescript
Imports: next
export metadata: Metadata = {
    title: 'Privacy Policy - Fast Takeoff News',
    description: 'Privacy Policy for Fast Takeoff News-IG app.',
}
export function PrivacyPolicy(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/profile/page.tsx

```typescript
Imports: @/components/ui/button, @/components/ui/card, @/components/ui/loader, @clerk/nextjs, next/navigation, react
export function ProfilePage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/app/rss/route.ts

```typescript
Imports: @/lib/config, @/lib/data/channels-service, @/lib/data/report-service, @/lib/utils, next/server
export function GET(): Promise<NextResponse<unknown>>
```

## src/app/sign-in/[[...sign-in]]/page.tsx

```typescript
Imports: @clerk/nextjs
export function Page(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/sign-up/[[...sign-up]]/page.tsx

```typescript
Imports: @clerk/nextjs
export function SignUpPage(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/app/sitemap-index.xml/route.ts

```typescript
Imports: next / server;
export function GET(): Promise<NextResponse<unknown>>;
```

## src/app/sitemap.xml/route.ts

```typescript
Imports: @/lib/data/sitemap-service, @/lib/utils, next/server
export function GET(): Promise<NextResponse<unknown>>
export dynamic = 'force-dynamic'
```

## src/components/Footer.tsx

```typescript
Imports: @/components/ui/separator, @/lib/hooks/useGeolocation, next/link
export function Footer(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/Header.tsx

```typescript
Imports: @/components/ui/button, @/lib/hooks/useGeolocation, @clerk/nextjs, lucide-react, next/image, next/link, react, ./ui/sheet
export function Header(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/HomeContent.tsx

```typescript
Imports: @/components/current-events/ReportCard, @/components/executive-orders/OrderCard, @/components/skeletons/ReportCardSkeleton, @/components/ui/button, @/components/ui/input, @/lib/hooks/useGeolocation, @/lib/types/core, next/link, react
export function HomeContent({ initialReports, initialExecutiveOrders }: HomeContentProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/MessageHeatmap.tsx

```typescript
Imports: @/lib/hooks, react
export function MessageHeatmap(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/ReportPanel.tsx

```typescript
Imports: @/components/ui/button, @/components/utils/LocalDateTime, lucide-react, next/link
export ReportPanel: React.FC<ReportPanelProps> = ({ report, onClose }) => {
    const paragraphs = report.body.split('\n\n').filter(Boolean);

    return (
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-l border-border h-full w-full p-6 overflow-y-auto overscroll-contain">
            <div className="flex justify-between items-start mb-6">
                <h2 className="text-xl font-semibold text-primary">{report.headline}</h2>
                <Button variant="ghost" size="icon" onClick={onClose} className="mt-[-8px] mr-[-8px]">
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-4">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>{report.city.charAt(0).toUpperCase() + report.city.toLowerCase().slice(1)}</span>
                    <span className="mx-2">•</span>
                    <LocalDateTimeFull
                        dateString={report.generatedAt}
                        options={{ dateStyle: 'short', timeStyle: 'short' }}
                    />
                </div>

                <div className="leading-relaxed">
                    {paragraphs.map((paragraph, index) => (
                        <p key={index} className="mb-4 last:mb-0 text-justify text-card">
                            {paragraph}
                        </p>
                    ))}
                </div>

                <div className="pt-4">
                    <Link href={`/current-events/${report.channelId}/${report.reportId}`}>
                        <Button className="w-full">
                            View Full Report
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
```

## src/components/RootLayoutClient.tsx

```typescript
Imports: @/components/auth/AuthProvider, @/components/Footer, @/components/Header, @/lib/config, next/navigation, react
export function RootLayoutClient({ children }: RootLayoutClientProps): React.JSX.Element
```

## src/components/analytics/ThirdPartyScripts.tsx

```typescript
Imports: next / script;
export function ThirdPartyScripts(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element;
```

## src/components/auth/AuthProvider.tsx

```typescript
Imports: @clerk/nextjs, next/navigation, next/script, react
export function AuthProvider({ children }: PropsWithChildren): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/EntityDisplay.tsx

```typescript
Imports: @/components/ui/badge, @/components/ui/card, @/lib/types/core
export function EntityDisplay({ entities, showMentions = false, maxPerType = 5 }: EntityDisplayProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
export function EntitySummary({ entities }: EntitySummaryProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/components/current-events/FactCheckDisplay.tsx

```typescript
Imports: @/components/ui/badge, @/components/ui/button, @/components/ui/card, @/components/ui/loader, @/lib/hooks, @/lib/types/core, lucide-react, react, ./LinkPreview
export function FactCheckDisplay({ reportId, className, onDemandTrigger = false }: FactCheckDisplayProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/LinkBadge.tsx

```typescript
Imports: next/link, ../ui/badge
export function BadgeLink({ href, children, variant = "default", className }: BadgeLinkProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/LinkPreview.tsx

```typescript
Imports: @/lib/hooks, @/lib/types/core, lucide-react, next/image, react
export function LinkPreview({ url, className = "" }: LinkPreviewProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/MediaPreview.tsx

```typescript
Imports: @/components/ui/dialog, @radix-ui/react-visually-hidden, next/image
export function MediaPreview({ url, type, contentType, alt }: MediaPreviewProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/MessageItem.tsx

```typescript
Imports: @/components/utils/LocalDateTime, @/lib/types/core, @/lib/utils, @/lib/utils/twitter-utils, next/image, next/link, react, ./MediaPreview, ./TelegramEmbed, ./TranslationBadge, ./TweetEmbed
export function MessageItem({ message, noAccordion = false, channelId }: MessageItemProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/ReportCard.tsx

```typescript
Imports: @/components/ui/badge, @/components/ui/card, @/components/utils/LocalDateTime, @/lib/config, @/lib/types/core, next/link, ./LinkBadge
export function ReportCard({
    report,
    clickableChannel = true,
}: ReportCardProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/current-events/TelegramEmbed.tsx

```typescript
Imports: @/lib/utils, react
export function TelegramEmbed({ content, className = '' }: TelegramEmbedProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/components/current-events/TranslationBadge.tsx

```typescript
Imports: @/lib/utils/twitter-utils
export function TranslationBadge({ footerText, className = "" }: TranslationBadgeProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/components/current-events/TweetEmbed.tsx

```typescript
Imports: @/lib/types/core, @/lib/utils/twitter-utils, react
export function TweetEmbed({ content, channelId, className = '', onEmbedFail }: TweetEmbedProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element | null
```

## src/components/current-events/timeline/MessageItemTimeline.tsx

```typescript
Imports: @/components/current-events/MediaPreview, @/components/current-events/TweetEmbed, @/components/ui/accordion, @/components/utils/LocalDateTime, @/lib/types/core, next/image, react
export function MessageItemTimeline({ message, index, noAccordion = false, channelId }: MessageItemProps): React.JSX.Element
```

## src/components/current-events/timeline/MessageTimeline.tsx

```typescript
Imports: @/lib/types/core, ./MessageItemTimeline
export function MessageTimeline({ messages, channelId }: MessageTimelineProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/executive-orders/OrderCard.tsx

```typescript
Imports: @/lib/types/core, @/lib/utils, next/link, ../ui/button, ../ui/card
export function OrderCard({ order }: { order: ExecutiveOrder }): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/skeletons/ReportCardSkeleton.tsx

```typescript
Imports: @/components/ui/card
export function ReportCardSkeleton(): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/source-attribution/AttributedReportViewer.tsx

```typescript
Imports: @/lib/hooks, @/lib/types/core, react, ./InteractiveReportBody
export function AttributedReportViewer({
    reportId,
    reportBody,
    sourceMessages,
    channelId,
    className = '',
    showAttributions = true,
    onLoadingChange
}: AttributedReportViewerProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/source-attribution/InteractiveReportBody.tsx

```typescript
Imports: @/lib/types/core, react, ./SourceTooltip
export function InteractiveReportBody({
    reportBody,
    attributions,
    sourceMessages,
    className = '',
    showAttributions = true
}: InteractiveReportBodyProps): React.JSX.Element
```

## src/components/source-attribution/SourceTooltip.tsx

```typescript
Imports: @/components/ui/popover, @/components/utils/LocalDateTime, @/lib/types/core, @/lib/utils, @/lib/utils/twitter-utils, next/image, next/link, ../current-events/MediaPreview
export function SourceTooltip({ attribution, sourceMessages, children }: SourceTooltipProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/ui/accordion.tsx

```typescript
Imports: @radix-ui/react-accordion, lucide-react, react, @/lib/utils
export function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>): React.JSX.Element
export function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>): React.JSX.Element
export function AccordionTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>): React.JSX.Element
export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>): React.JSX.Element
```

## src/components/ui/badge.tsx

```typescript
Imports: @radix-ui/react-slot, class-variance-authority, react, @/lib/utils
export function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }): React.JSX.Element
```

## src/components/ui/button.tsx

```typescript
Imports: @radix-ui/react-slot, class-variance-authority, react, @/lib/utils
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }): React.JSX.Element
```

## src/components/ui/card.tsx

```typescript
Imports: react, @/lib/utils
export function Card({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function CardHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function CardTitle({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function CardDescription({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function CardContent({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function CardFooter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
```

## src/components/ui/dialog.tsx

```typescript
Imports: @radix-ui/react-dialog, lucide-react, react, @/lib/utils
export function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>): React.JSX.Element
export function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>): React.JSX.Element
export function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>): React.JSX.Element
export function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>): React.JSX.Element
export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>): React.JSX.Element
export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>): React.JSX.Element
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>): React.JSX.Element
export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>): React.JSX.Element
```

## src/components/ui/dropdown-menu.tsx

```typescript
Imports: react, @radix-ui/react-dropdown-menu, lucide-react, @/lib/utils
export function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>): React.JSX.Element
export function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>): React.JSX.Element
export function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>): React.JSX.Element
export function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>): React.JSX.Element
export function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>): React.JSX.Element
export function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}): React.JSX.Element
export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>): React.JSX.Element
export function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>): React.JSX.Element
export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>): React.JSX.Element
export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}): React.JSX.Element
export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>): React.JSX.Element
export function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element
export function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>): React.JSX.Element
export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}): React.JSX.Element
export function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>): React.JSX.Element
```

## src/components/ui/input.tsx

```typescript
Imports: react, @/lib/utils
export function Input({ className, type, ...props }: React.ComponentProps<"input">): React.JSX.Element
```

## src/components/ui/loader.tsx

```typescript
Imports: @/lib/utils, lucide-react
export function Loader({ size = "md", className, ...props }: LoaderProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/components/ui/pagination.tsx

```typescript
Imports: react, lucide-react, @/lib/utils, @/components/ui/button
export function Pagination({ className, ...props }: React.ComponentProps<"nav">): React.JSX.Element
export function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">): React.JSX.Element
export function PaginationItem({ ...props }: React.ComponentProps<"li">): React.JSX.Element
export function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps): React.JSX.Element
export function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>): React.JSX.Element
export function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>): React.JSX.Element
export function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">): React.JSX.Element
```

## src/components/ui/popover.tsx

```typescript
Imports: @radix-ui/react-popover, react, @/lib/utils
export function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>): React.JSX.Element
export function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>): React.JSX.Element
export function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>): React.JSX.Element
export function PopoverArrow({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Arrow>): React.JSX.Element
export function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>): React.JSX.Element
```

## src/components/ui/select.tsx

```typescript
Imports: @radix-ui/react-select, lucide-react, react, @/lib/utils
export function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>): React.JSX.Element
export function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>): React.JSX.Element
export function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>): React.JSX.Element
export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>): React.JSX.Element
export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>): React.JSX.Element
export function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>): React.JSX.Element
export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>): React.JSX.Element
export function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>): React.JSX.Element
export function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>): React.JSX.Element
export function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>): React.JSX.Element
```

## src/components/ui/separator.tsx

```typescript
Imports: react, @radix-ui/react-separator, @/lib/utils
export function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>): React.JSX.Element
```

## src/components/ui/sheet.tsx

```typescript
Imports: @radix-ui/react-dialog, lucide-react, react, @/lib/utils
export function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>): React.JSX.Element
export function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>): React.JSX.Element
export function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>): React.JSX.Element
export function SheetContent({
  className,
  children,
  side = "right",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
}): React.JSX.Element
export function SheetHeader({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">): React.JSX.Element
export function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>): React.JSX.Element
export function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>): React.JSX.Element
```

## src/components/ui/tabs.tsx

```typescript
Imports: @radix-ui/react-tabs, react, @/lib/utils
export function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>): React.JSX.Element
export function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>): React.JSX.Element
export function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>): React.JSX.Element
export function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>): React.JSX.Element
```

## src/components/ui/tooltip.tsx

```typescript
Imports: @radix-ui/react-tooltip, react, @/lib/utils
export function TooltipProvider({
  delayDuration = 500,
  skipDelayDuration = 200,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>): React.JSX.Element
export function Tooltip({
  delayDuration,
  skipDelayDuration,
  disableHoverableContent,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root> & {
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}): React.JSX.Element
export function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>): React.JSX.Element
export function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>): React.JSX.Element
```

## src/components/utils/ClientOnly.tsx

```typescript
Imports: react;
/**
Wrapper component that only renders children on the client side
Prevents hydration mismatches for components that render differently on server vs client
*/
export function ClientOnly({
  children,
  fallback = null,
}: ClientOnlyProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element;
```

## src/components/utils/LocalDateTime.tsx

```typescript
Imports: @/lib/utils, ./ClientOnly
/**
Component that displays dates and times in the user's local timezone
Prevents hydration mismatches by showing UTC on server and local time on client
*/
export function LocalDateTime({
    dateString,
    type = 'datetime',
    showDate = false,
    className,
    options
}: LocalDateTimeProps): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
export function LocalDate({ dateString, className, options }: Omit<LocalDateTimeProps, 'type'>): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
export function LocalTime({ dateString, showDate, className }: Omit<LocalDateTimeProps, 'type' | 'options'>): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
export function LocalDateTimeFull({ dateString, className, options }: Omit<LocalDateTimeProps, 'type'>): import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").JSX.Element
```

## src/lib/ai-config.ts

```typescript
Imports: @/lib/config
/**
Retrieves the configuration for a specific AI provider, or the active one by default.

@param providerName The name (key) of the provider in AI_PROVIDERS. Defaults to the active provider.
@returns The configuration object for the requested provider.
@throws Error if the specified providerName is not found in AI_PROVIDERS.
*/
export function getAIProviderConfig(providerName: string = ACTIVE_AI_PROVIDER_NAME): AIProviderConfig
/**
Retrieves the API key for a specific AI provider, or the active one by default.
It checks the Cloudflare environment object first, then process.env.

@param env Optional Cloudflare environment object (containing secrets).
@param providerName The name (key) of the provider. Defaults to the active provider.
@returns The API key for the requested provider.
@throws Error if the API key environment variable is not set for the specified provider.
*/
export function getAIAPIKey(env?: { [key: string]: string | undefined }, providerName: string = ACTIVE_AI_PROVIDER_NAME): string
```

## src/lib/api-utils.ts

```typescript
Imports: @/lib/utils, next/server, ../../worker-configuration
export API_CACHE_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=60' }
export function withErrorHandling(handler: (env: Cloudflare.Env) => Promise<T>, errorMessage: string): Promise<NextResponse<unknown>>
```

## src/lib/cache-utils.ts

```typescript
Imports: ../../worker-configuration
export class CacheManager
  clearRequestCache(): void
  get(namespace: keyof Cloudflare.Env, key: string, timeoutMs: number = 5000): Promise<T | null>
  put(namespace: keyof Cloudflare.Env, key: string, value: T, ttl: number): Promise<void>
  refreshInBackground(key: string, namespace: keyof Cloudflare.Env, fetchFn: () => Promise<T>, ttl: number): Promise<void>
  batchGet(namespace: keyof Cloudflare.Env, keys: string[], timeoutMs: number = 1500): Promise<Map<string, T | null>>
  list(namespace: keyof Cloudflare.Env, options: { prefix?: string; limit?: number } = {}, timeoutMs: number = 5000): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: unknown; }>; }>
  delete(namespace: keyof Cloudflare.Env, key: string, timeoutMs: number = 5000): Promise<void>
  putRaw(namespace: keyof Cloudflare.Env, key: string, value: string, options: { expirationTtl?: number } = {}): Promise<void>
  getKVNamespace(namespace: keyof Cloudflare.Env): KVNamespace<string> | null
```

## src/lib/clerkUtils.ts

```typescript
Imports: @clerk/nextjs/server
export function updateUserSubscription(userId: string): Promise<void>
```

## src/lib/config.ts

```typescript
Imports: dotenv
/**
Defines the structure for an AI provider's configuration.
*/
export interface AIProviderConfig {  endpoint: string;  model: string;  apiKeyEnvVar: string;  displayName: string;
}
/**
Centralized registry for all supported AI providers.
*/
export AI_PROVIDERS: Record<string, AIProviderConfig> = {
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
    perplexity: {
        endpoint: 'https://api.perplexity.ai/chat/completions',
        model: 'sonar',
        apiKeyEnvVar: 'PERPLEXITY_API_KEY',
        displayName: 'Perplexity Sonar',
    },
}
/**
Specifies the key (name) of the AI provider to be used by default throughout the application.
To change the provider, modify this value and redeploy.
*/
export ACTIVE_AI_PROVIDER_NAME: string = 'openrouter'
/**
Application configuration
Centralizes all configurable values in the application
*/
export API = {
    DISCORD: {
        BASE_URL: 'https://discord.com/api/v10',
        USER_AGENT: 'NewsApp/0.1.0 (https://news.fasttakeoff.org)',
    },
    // GROQ and OPENROUTER sections removed, managed by AI_PROVIDERS now
}
export URLs = {
    INSTAGRAM_WORKER: 'https://instagram-webhook-worker.gsaboia.workers.dev/post',
    BRAIN_IMAGE: 'https://news.fasttakeoff.org/images/brain.png',
    WEBSITE_URL: 'https://news.fasttakeoff.org',
}
export DISCORD = {
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
}
export CACHE = {
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
        REPORTS: 365 * 24 * 60 * 60, // 1 year
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
}
export TIME = {
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
}
export AI = {
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
- Headline: Specific, non-sensational, in ALL CAPS
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
}
export type TimeframeKey = typeof TIME.TIMEFRAMES[number]
export RSS_FEEDS: Record<string, string> = {
    'CNN-Brasil': 'https://www.cnnbrasil.com.br/feed/',
    'BBC-Brasil': 'https://feeds.bbci.co.uk/portuguese/rss.xml',
    // 'G1': 'https://g1.globo.com/rss/g1/',
    'UOL': 'https://rss.uol.com.br/feed/noticias.xml',
    'G1 - Política': 'https://g1.globo.com/rss/g1/politica/',
    'G1 - Economia': 'https://g1.globo.com/rss/g1/economia/',
}
export ERROR_NO_OPENAI_KEY = 'Missing OPENAI_API_KEY'
export ERROR_NO_DISCORD_TOKEN = 'Missing DISCORD_BOT_TOKEN'
export ENTITY_COLORS: { [key: string]: string } = {
    // Power network types (lowercase)
    person: '#4a90e2',   // Blue
    company: '#7ed321',  // Green
    fund: '#e67e22',     // Orange

    PERSON: '#4a90e2',
    ORGANIZATION: '#7ed321',
    LOCATION: '#e67e22',
    DEFAULT: '#888888'
}
export ENTITY_LABELS: { [key: string]: string } = {
    PERSON: 'People',
    ORGANIZATION: 'Organizations',
    LOCATION: 'Locations',
}
export UI = {
    // Pages that should not display header and footer (full-screen experience)
    FULL_SCREEN_PAGES: ['/news-globe', '/power-network', '/entities/graph'],
}
```

## src/lib/cron.ts

```typescript
Imports: ../../worker-configuration, ./data/feeds-service, ./data/messages-service, ./data/report-service
export function scheduled(event: ScheduledEvent, env: Cloudflare.Env): Promise<void>
```

## src/lib/data/channels-service.ts

```typescript
Imports: @/lib/config, @/lib/types/core, ../../../worker-configuration, ../cache-utils, ./messages-service
export class ChannelsService
  filterChannels(channels: DiscordChannel[]): DiscordChannel[]
  fetchAllChannelsFromAPI(): Promise<DiscordChannel[]>
  getChannels(): Promise<DiscordChannel[]>
  getChannelDetails(channelId: string): Promise<{ channel: DiscordChannel | null; messages: { count: number; messages: DiscordMessage[]; }; }>
  getChannelName(channelId: string): Promise<string>
export function getChannels(env: Cloudflare.Env): Promise<DiscordChannel[]>
export function getChannelDetails(env: Cloudflare.Env, channelId: string): Promise<{ channel: DiscordChannel | null; messages: { count: number; messages: DiscordMessage[]; }; }>
export function getChannelName(env: Cloudflare.Env, channelId: string): Promise<string>
```

## src/lib/data/executive-orders.ts

```typescript
Imports: @/lib/types/api, @/lib/types/core, ../../../worker-configuration, ../cache-utils, ../transformers/executive-orders
export function fetchExecutiveOrders(page: number = 1, startDate: string = '2025-01-20', category?: string): Promise<ApiResponse>
export function fetchExecutiveOrderById(id: string, env?: Cloudflare.Env): Promise<ExecutiveOrder | null>
export function findExecutiveOrderByNumber(eoNumber: string, date?: string, env?: Cloudflare.Env): Promise<string | null>
```

## src/lib/data/feeds-service.ts

```typescript
Imports: @/lib/cache-utils, @/lib/config, @/lib/types/core, ../../../worker-configuration, ../ai-config, ../config, ./rss-service
export function summarizeFeed(input: SummaryInputData & { env: Cloudflare.Env }): Promise<SummaryResult>
export function summarizeFeeds(feedIds: string[], env: Cloudflare.Env): Promise<SummaryResult>
export class FeedsService
  getCachedSummary(): Promise<SummaryResult | null>
  listAvailableSummaries(): Promise<{ key: string; createdAt: string; }[]>
  getSummaryByKey(key: string): Promise<SummaryResult | null>
  getOrCreateSummary(): Promise<SummaryResult>
  getMostRecentCachedSummary(): Promise<SummaryResult | null>
  createFreshSummary(): Promise<SummaryResult>
```

## src/lib/data/messages-service.ts

```typescript
Imports: @/lib/config, @/lib/types/core, ../../../worker-configuration, ../cache-utils, ./channels-service
export class MessagesService
  fetchBotMessagesFromAPI(channelId: string, sinceOverride?: Date): Promise<DiscordMessage[]>
  getMessages(channelId: string, options: { since?: Date; limit?: number } = {}): Promise<DiscordMessage[]>
  getMessagesForTimeframe(channelId: string, timeframe: TimeframeKey): Promise<DiscordMessage[]>
  getMessagesForReport(channelId: string, messageIds: string[]): Promise<DiscordMessage[]>
  getAllCachedMessagesForChannel(channelId: string): Promise<CachedMessages | null>
  getCachedMessagesSince(channelId: string, since: Date = new Date(Date.now() - TIME.ONE_HOUR_MS)): Promise<CachedMessages | null>
  cacheMessages(channelId: string, messages: DiscordMessage[], channelName?: string): Promise<void>
  updateMessages(): Promise<void>
  listMessageKeys(): Promise<{ name: string; }[]>
```

## src/lib/data/report-service.ts

```typescript
Imports: @/lib/config, @/lib/types/core, ../../../worker-configuration, ../facebook-service, ../instagram-service, ../twitter-service, ../utils/entity-extraction, ../utils/fact-check-service, ../utils/report-ai, ../utils/report-cache, ./channels-service, ./messages-service
export class ReportService
  createReportAndGetMessages(channelId: string, timeframe: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[]; }>
/**
Get reports with their cached entities for UI display
*/
  getReportsWithEntities(limit?: number): Promise<(Report & { entities?: EntityExtractionResult | null; })[]>
/**
Get latest reports per channel with their entities
*/
  getLatestReportPerChannelWithEntities(): Promise<(Report & { entities?: EntityExtractionResult | null; })[]>
  getLastReportAndMessages(channelId: string, timeframe: TimeframeKey = '2h'): Promise<{ report: Report | null; messages: DiscordMessage[]; }>
  getReportAndMessages(channelId: string, reportId: string, timeframe?: TimeframeKey): Promise<{ report: Report | null; messages: DiscordMessage[]; }>
  getReport(reportId: string): Promise<Report | null>
  getReportTimeframe(reportId: string): Promise<"2h" | "6h" | undefined>
  getAllReports(limit?: number): Promise<Report[]>
  getAllReportsForChannel(channelId: string, timeframe?: TimeframeKey): Promise<Report[]>
  getLatestReportPerChannel(): Promise<Report[]>
/**
Production method: Generates reports for timeframes active based on the current UTC hour.
Smart scheduling: 2h reports every 2 hours (2am, 4am, 8am, 10am, 2pm, 4pm, 8pm, 10pm)
6h reports every 6 hours (12am, 6am, 12pm, 6pm)
*/
  createFreshReports(extractEntities: boolean = false): Promise<void>
/**
Manual trigger method: Generates reports for specified timeframes or all configured timeframes.
*/
  generateReportsForManualTrigger(manualTimeframes: TimeframeKey[] | 'ALL', extractEntities: boolean = false): Promise<void>
/**
Manual trigger method: Generates reports without social media posting.
Useful for testing or when social media posting is not desired.
*/
  generateReportsWithoutSocialMedia(manualTimeframes: TimeframeKey[] | 'ALL', extractEntities: boolean = false): Promise<void>
```

## src/lib/data/rss-service.ts

```typescript
Imports: @/lib/config, @/lib/types/core, rss-parser
/**
Returns the list of configured feed IDs.
*/
export function getAvailableFeeds(): string[]
/**
Fetches and parses the RSS feed for the given feed ID.
@param feedId The key of the feed in RSS_FEEDS
@param sinceTimestamp Optional timestamp to filter items, only returning items newer than this timestamp
@throws Error if the feedId is invalid, fetching fails, or parsing fails
*/
export function getFeedItems(feedId: string, sinceTimestamp?: number): Promise<FeedItem[]>
```

## src/lib/data/sitemap-service.ts

```typescript
Imports: ../../../worker-configuration, ../types/core, ./report-service
export class SitemapService
/**
Generates a complete sitemap XML with all static pages and dynamic reports
*/
  generateFullSitemap(): Promise<string>
/**
Generates and stores the sitemap in cache
*/
  updateSitemapCache(): Promise<void>
/**
Gets the cached sitemap or generates a fallback
*/
  getCachedSitemap(): Promise<string>
```

## src/lib/facebook-service.ts

```typescript
Imports: ../../worker-configuration, ./config, ./types/core
export class FacebookService
  postNews(report: Report): Promise<void>
  testConnection(): Promise<boolean>
```

## src/lib/hooks/useApi.ts

```typescript
Imports: react;
export function useApi(
  fetcher: (...args: unknown[]) => Promise<T>,
  options: UseApiOptions<T> = {}
): UseApiState<T>;
```

## src/lib/hooks/useBasicForceSimulation.ts

```typescript
Imports: react, ./useNodes
/**
A lightweight force-directed simulation identical to the original
implementation used by the Power-Network prior to the entity-graph refactor.
 • Inverse-square repulsion between every pair of nodes.
 • Spring-like attraction for linked nodes toward a target distance.
 • Simple damping applied every tick.
*/
export function useBasicForceSimulation(nodesRef: React.MutableRefObject<Node[]>, relationships?: Relationship[], isMobile: boolean = false): () => void
```

## src/lib/hooks/useCanvasCamera.ts

```typescript
Imports: react;
export function useCanvasCamera(): {
  cameraRef: import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").RefObject<Camera>;
  onWheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onPanStart: (clientX: number, clientY: number) => void;
  onPanMove: (clientX: number, clientY: number) => void;
  onPanEnd: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => void;
  centerOnNode: (
    nodeX: number,
    nodeY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => void;
};
```

## src/lib/hooks/useEntityRelevance.ts

```typescript
Imports: react, ../utils/entity-relevance-scorer
export interface GraphData {  entities: Record<string, Entity>;  relationships: Relationship[];
}
export interface UseEntityRelevanceResult {  scorer: EntityRelevanceScorer;  getEntityScore: (entityId: string) => EntityRelevanceScore;  getTopEntities: (count?: number) => EntityRelevanceScore[];  getTopEntitiesByScore: (count?: number) => EntityRelevanceScore[];  getTopEntitiesByFinancialValue: (count?: number) => EntityRelevanceScore[];  getAllScores: () => Map<string, EntityRelevanceScore>;  isHighRelevance: (entityId: string) => boolean;  isHighFinancialValue: (entityId: string) => boolean;  shouldShowDetails: (entityId: string, threshold?: number) => boolean;
}
export function useEntityRelevance(graphData: GraphData | null): UseEntityRelevanceResult | null
export function formatEntityRelevance(score: EntityRelevanceScore): string
export function formatFinancialValue(score: EntityRelevanceScore): string
export function getRelevanceDisplayClass(score: EntityRelevanceScore): string
export function getFinancialValueDisplayClass(score: EntityRelevanceScore): string
```

## src/lib/hooks/useFilters.ts

```typescript
Imports: react;
export function useFilters(entityTypes: string[] = DEFAULT_TYPES): {
  searchTerm: string;
  setSearchTerm: import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").Dispatch<
    import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").SetStateAction<string>
  >;
  filters: Record<string, boolean>;
  toggleFilter: (type: string) => void;
  isNodeVisible: (
    node: Node,
    selectedNode: Node | null,
    relationships?: Relationship[]
  ) => boolean;
};
```

## src/lib/hooks/useForceSimulation.ts

```typescript
Imports: react, ./useNodes
export function useForceSimulation(nodesRef: React.MutableRefObject<Node[]>, relationships?: Relationship[]): () => void
```

## src/lib/hooks/useGeolocation.ts

```typescript
Imports: react;
/**
Hook to determine if the user is US-based via geolocation API
Consolidates duplicate geo-checking logic across components
*/
export function useGeolocation(options: UseGeolocationOptions = {}): {
  isUSBased: boolean | null;
  loading: boolean;
  error: string | null;
};
```

## src/lib/hooks/useGraphData.ts

```typescript
Imports: react;
export interface GraphData {
  entities: Record<string, Entity>;
  relationships: Relationship[];
}
export function useGraphData(): {
  graphData: GraphData | null;
  loading: boolean;
  error: string | null;
};
```

## src/lib/hooks/useMobileBreakpoint.ts

```typescript
Imports: react;
export function useMobileBreakpoint(breakpoint: number = 768): boolean;
```

## src/lib/hooks/useNetworkRenderer.ts

```typescript
Imports: @/lib/config, react, ./useNodes
export function useNetworkRenderer({
    canvasRef,
    nodesRef,
    cameraRef,
    relationships,
    selectedNode,
    isNodeVisible,
    tick
}: UseNetworkRendererProps): null
```

## src/lib/hooks/useNodeSelection.ts

```typescript
Imports: react, ./useNodes
export function useNodeSelection(nodesRef: React.MutableRefObject<Node[]>, cameraRef: React.MutableRefObject<Camera>, isNodeVisible: (node: Node) => boolean): { selectedNode: Node | null; setSelectedNode: import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").Dispatch<import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").SetStateAction<Node | null>>; canvasHandlers: { onMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => { type: "drag"; node: Node; startPos?: undefined; } | { type: "pan"; startPos: { x: number; y: number; }; node?: undefined; }; onMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => { type: "drag"; clientPos?: undefined; } | { type: "pan"; clientPos: { x: number; y: number; }; }; onMouseUp: () => { type: "end"; }; onTouchStart: (e: React.TouchEvent<HTMLCanvasElement>) => { type: "drag"; node: Node; startPos?: undefined; } | { type: "pan"; startPos: { x: number; y: number; }; node?: undefined; } | { type: "pinch"; node?: undefined; startPos?: undefined; } | { type: "none"; node?: undefined; startPos?: undefined; }; onTouchMove: (e: React.TouchEvent<HTMLCanvasElement>) => { type: "drag"; clientPos?: undefined; } | { type: "pan"; clientPos: { x: number; y: number; }; } | { type: "pinch"; clientPos?: undefined; }; onTouchEnd: (e: React.TouchEvent<HTMLCanvasElement>) => { type: "end"; }; }; }
```

## src/lib/hooks/useNodes.ts

```typescript
Imports: react, ../types/core
export interface Node {  country?: string;  x: number;  y: number;  vx: number;  vy: number;  radius: number;
}
export function useNodes(graphData: GenericGraphData, isMobile: boolean): { nodesRef: import("/Users/guilhermesaboia/Documents/fasttakeoff/news.fasttakeoff.org/node_modules/@types/react/index").RefObject<Node[]>; }
```

## src/lib/instagram-service.ts

```typescript
Imports: ../../worker-configuration, ./config, ./types/core
export class InstagramService
  postNews(report: Report): Promise<void>
```

## src/lib/seo/ping-search-engines.ts

```typescript
export function pingSearchEngines(newUrls: string[]): Promise<void>;
```

## src/lib/transformers/executive-orders.ts

```typescript
Imports: ../types/api, ../types/core
export function transformAgency(agency: FederalRegisterAgency): Agency
export function transformImages(images: Record<string, Record<string, string>> | undefined): Record<string, Image> | undefined
export function transformFederalRegisterOrder(order: FederalRegisterOrder): ExecutiveOrder
export function transformFederalRegisterOrders(orders: FederalRegisterOrder[]): ExecutiveOrder[]
```

## src/lib/twitter-service.ts

```typescript
Imports: @/lib/types/core, ../../worker-configuration, ./config, ./utils/twitter-utils
export class TwitterService
/**
Posts a single tweet with headline and URL
*/
  postSingleTweet(report: Report): Promise<void>
/**
Posts a threaded tweet for a report
@deprecated Use postSingleTweet instead for simpler posting
*/
  postThreadedTweet(report: Report): Promise<void>
/**
Posts a tweet using a valid access token obtained from KV (refreshes if needed).
Now uses single tweet format with headline and URL
*/
  postTweet(report: Report): Promise<void>
```

## src/lib/types/api.ts

```typescript
Imports: ./core
export interface FederalRegisterAgency {  json_url?: string;  slug?: string;  raw_name?: string;  parent_id?: number | null;
}
export interface FederalRegisterOrder {  document_number: string;  title: string;  publication_date: string;  signing_date: string;  executive_order_number: number;  presidential_document_type: string;  abstract?: string;  html_url: string;  pdf_url: string;  type: string;  agencies: FederalRegisterAgency[];  body_html?: string;  body_html_url?: string;  raw_text_url?: string;  full_text_xml_url?: string;  citation?: string;  start_page?: number;  end_page?: number;  volume?: number;  disposition_notes?: string;  executive_order_notes?: string;  presidential_document_number?: string;  toc_doc?: string;  toc_subject?: string;  subtype?: string;  mods_url?: string;  images?: Record<string, Record<string, string>>;
}
export interface FederalRegisterResponse {  count: number;  total_pages: number;  results: FederalRegisterOrder[];
}
export interface PaginationInfo {  currentPage: number;  totalPages: number;  totalOrders: number;
}
export interface ApiResponse {  orders: ExecutiveOrder[];  pagination: PaginationInfo;
}
```

## src/lib/types/core.ts

```typescript
export interface ExecutiveOrderBase {
  id: string;
  title: string;
  date: string;
  orderNumber: number;
  category: string;
  summary: string;
}
export interface Section {
  title: string;
  content: string;
}
export interface Content {
  rawText?: string;
  html?: string;
  xml?: string;
  sections: Section[];
}
export interface Agency {
  id: number;
  name: string;
  url?: string;
  parentId?: number | null;
}
export interface Publication {
  citation?: string;
  volume?: number;
  startPage?: number;
  endPage?: number;
  publicationDate?: string;
  signingDate?: string;
}
export interface DocumentLinks {
  htmlUrl?: string;
  pdfUrl?: string;
  bodyHtmlUrl?: string;
  rawTextUrl?: string;
  fullTextXmlUrl?: string;
  modsUrl?: string;
}
export interface DocumentMetadata {
  documentType?: string;
  subtype?: string;
  tocDoc?: string;
  tocSubject?: string;
  presidentialDocumentNumber?: string;
  executiveOrderNotes?: string;
  dispositionNotes?: string;
}
export interface Image {
  url: string;
  type: string;
  size?: string;
}
export interface ExecutiveOrder {
  content: Content;
  publication: Publication;
  links: DocumentLinks;
  metadata: DocumentMetadata;
  agencies: Agency[];
  images?: Record<string, Image>;
  relatedOrders?: string[];
}
export interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: {
    username: string;
    discriminator: string;
    avatar: string;
    global_name: string;
    id: string;
  };
  embeds?: {
    type?: string;
    url?: string;
    title?: string;
    description?: string;
    timestamp?: string;
    fields?: { name: string; value: string; inline?: boolean }[];
    author?: {
      name: string;
      icon_url?: string;
      proxy_icon_url?: string;
    };
    footer?: {
      text: string;
    };
    thumbnail?: {
      url: string;
      proxy_url?: string;
      width?: number;
      height?: number;
      content_type?: string;
      placeholder?: string;
      placeholder_version?: number;
      flags?: number;
    };
    content_scan_version?: number;
  }[];
  referenced_message?: {
    author: {
      username: string;
      discriminator: string;
      avatar: string;
      global_name: string;
      id: string;
    };
    content: string;
  };
  attachments?: {
    url: string;
    filename: string;
    content_type: string;
    size: number;
    id: string;
  }[];
}
export interface PermissionOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}
export interface DiscordChannel {
  id: string;
  type: number;
  guild_id?: string;
  position: number;
  permission_overwrites: PermissionOverwrite[];
  name: string;
  topic?: string | null;
  nsfw?: boolean;
  last_message_id?: string | null;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: {
    id: string;
    username: string;
    discriminator: string;
    avatar: string;
    global_name?: string;
  }[];
  icon?: string | null;
  owner_id?: string;
  application_id?: string;
  parent_id?: string | null;
  last_pin_timestamp?: string | null;
  rtc_region?: string | null;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: {
    archived: boolean;
    auto_archive_duration: number;
    archive_timestamp: string;
    locked: boolean;
    invitable?: boolean;
    create_timestamp?: string | null;
  };
  member?: {
    id?: string;
    user_id?: string;
    join_timestamp: string;
    flags: number;
  };
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: string[];
  applied_tags?: string[];
  default_reaction_emoji?: string | null;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number | null;
  default_forum_layout?: number;
  hasActivity?: boolean;
  lastMessageTimestamp?: string | null;
  messageCount?: number;
  messages?: DiscordMessage[];
}
export interface Report {
  headline: string;
  city: string;
  body: string;
  reportId: string;
  generatedAt: string;
  channelId?: string;
  channelName?: string;
  cacheStatus?: "hit" | "miss";
  messageCount?: number;
  lastMessageTimestamp?: string;
  userGenerated?: boolean;
  messageIds?: string[];
  timeframe?: string;
}
export interface CachedMessages {
  messages: DiscordMessage[];
  cachedAt: string;
  messageCount: number;
  lastMessageTimestamp: string;
  channelName: string;
}
export interface ReportResponse {
  report: Report;
  messages: DiscordMessage[];
  previousReportId?: string | null;
  nextReportId?: string | null;
}
export interface FeedItem {
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  enclosureUrl?: string;
  categories?: string[];
}
export interface SummaryInputData {
  feedId?: string;
  isCombined: boolean;
  articles: FeedItem[];
  timeRange: string;
}
export interface SelectedStory {
  title: string;
  importance: number;
  reasoning: string;
  originalSnippet: string;
  pubDate: string;
}
export interface UnselectedStory {
  title: string;
  originalSnippet: string;
  pubDate: string;
}
export interface SummaryMetrics {
  processingTimeMs: number;
  tokensUsed: number;
  totalCost: number;
}
export interface SummaryResult {
  input: {
    feedId?: string;
    isCombined: boolean;
    totalArticles: number;
    timeRange: string;
  };
  metrics: SummaryMetrics;
  selectedStories: SelectedStory[];
  unselectedStories: UnselectedStory[];
  summary: string;
}
export interface TweetEmbed {
  tweetId: string;
  url: string;
  html: string;
  author_name: string;
  author_url: string;
  provider_name: string;
  provider_url: string;
  cache_age?: number;
  width?: number;
  height?: number;
  cachedAt: string;
}
export interface TweetEmbedCache {}
export interface EntityMention {
  text: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}
export interface Entity {
  type: "person" | "company" | "fund";
  name: string;
  country: string;
  netWorth?: number;
  marketCap?: number;
  aum?: number;
}
export interface ExtractedEntity {
  type:
    | "PERSON"
    | "ORGANIZATION"
    | "LOCATION"
    | "EVENTS"
    | "DATES"
    | "FINANCIAL"
    | "PRODUCTS"
    | "OTHER";
  value: string;
  mentions: EntityMention[];
  relevanceScore: number;
  category?: string;
  reportId?: string;
}
export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  extractedAt: string;
  processingTimeMs: number;
  sourceLength: number;
}
export interface EnhancedReport {
  entities?: EntityExtractionResult;
}
export interface GraphNode {
  id: string;
  name: string;
  type: string;
  relevance: number;
  connectionCount: number;
  netWorth?: number;
  marketCap?: number;
  aum?: number;
}
export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
export interface TransformedGraphData {
  entities: { [key: string]: GraphNode };
  relationships: { from: string; to: string; type: string; strength: number }[];
}
/**
Represents a segment of text in a report with its corresponding source attribution
*/
export interface SourceAttribution {
  /**
  Unique identifier for this attribution
  */
  id: string;
  /**
  Start position of the text segment in the report body
  */
  startIndex: number;
  /**
  End position of the text segment in the report body
  */
  endIndex: number;
  /**
  The actual text content being attributed
  */
  text: string;
  /**
  Source message ID that this text segment is based on
  */
  sourceMessageId: string;
  /**
  Confidence score from 0-1 indicating how certain the attribution is
  */
  confidence: number;
}
/**
Complete source attribution data for a report
*/
export interface ReportSourceAttribution {
  /**
  The report ID this attribution belongs to
  */
  reportId: string;
  /**
  Array of all source attributions for the report
  */
  attributions: SourceAttribution[];
  /**
  Timestamp when attribution was generated
  */
  generatedAt: string;
  /**
  Version of attribution system used
  */
  version: string;
}
export interface Session {
  user?: {
    id: string;
  };
}
export interface FactCheckClaim {
  claim: string;
  verification: "verified" | "partially-verified" | "unverified" | "false";
  confidence: number;
  sources: string[];
  importance: number;
  details: string;
}
export interface FactCheckResult {
  reportId: string;
  overallCredibility: "high" | "medium" | "low";
  verificationSummary: string;
  claims: FactCheckClaim[];
  improvements: string[];
  missingContext: string[];
  checkedAt: string;
  version: string;
}
export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  domain: string;
  cachedAt: string;
}
```

## src/lib/types/executive-orders.ts

```typescript
export interface FederalRegisterOrder {
  document_number: string;
  title: string;
  publication_date: string;
  signing_date: string;
  executive_order_number: number;
  presidential_document_type: string;
  abstract?: string;
  html_url: string;
  pdf_url: string;
  type: string;
  agencies: Array<{
    name: string;
    id: number;
    url?: string;
    json_url?: string;
    slug?: string;
    raw_name?: string;
    parent_id?: number | null;
  }>;
  body_html?: string;
  body_html_url?: string;
  raw_text_url?: string;
  full_text_xml_url?: string;
  citation?: string;
  start_page?: number;
  end_page?: number;
  volume?: number;
  disposition_notes?: string;
  executive_order_notes?: string;
  presidential_document_number?: string;
  toc_doc?: string;
  toc_subject?: string;
  subtype?: string;
  mods_url?: string;
  images?: Record<string, Record<string, string>>;
}
export interface FederalRegisterResponse {
  count: number;
  total_pages: number;
  results: FederalRegisterOrder[];
}
export interface OrderDetails {
  full_text_xml?: string;
  body_html?: string;
  abstract?: string;
  executive_order_notes?: string;
  disposition_notes?: string;
  citation?: string;
  volume?: number;
  start_page?: number;
  end_page?: number;
  subtype?: string;
  type?: string;
  body_html_url?: string;
  raw_text_url?: string;
  full_text_xml_url?: string;
  mods_url?: string;
  toc_doc?: string;
  toc_subject?: string;
  presidential_document_number?: string;
  images?: Record<string, Record<string, string>>;
}
```

## src/lib/utils/entity-cache.ts

```typescript
Imports: @/lib/config, @/lib/types/core, ../../../worker-configuration, ../cache-utils
export class EntityCache
/**
Store entity extraction result for a report
*/
  store(reportId: string, entities: EntityExtractionResult, env: Cloudflare.Env): Promise<void>
/**
Get cached entity extraction result for a report
*/
  get(reportId: string, env: Cloudflare.Env): Promise<EntityExtractionResult | null>
/**
Batch get entity extraction results for multiple reports
*/
  batchGet(reportIds: string[], env: Cloudflare.Env): Promise<Map<string, EntityExtractionResult | null>>
/**
Check if entity extraction exists for a report
*/
  exists(reportId: string, env: Cloudflare.Env): Promise<boolean>
/**
Delete entity extraction for a report
*/
  delete(reportId: string, env: Cloudflare.Env): Promise<void>
/**
List all entity cache keys (useful for maintenance)
*/
  listKeys(env: Cloudflare.Env): Promise<{ name: string; }[]>
/**
Get entity extraction results for multiple reports efficiently
Used when displaying reports with their entities
*/
  getForReports(reportIds: string[], env: Cloudflare.Env): Promise<Record<string, EntityExtractionResult>>
```

## src/lib/utils/entity-extraction.ts

```typescript
Imports: @/lib/ai-config, @/lib/config, @/lib/types/core, ../../../worker-configuration, ./entity-cache
export interface EntityExtractionContext {  reportId?: string;  channelId?: string;  sourceType: 'report' | 'message' | 'summary';  processingHint?: string;
}
export class EntityExtractor
  extract(text: string, context: EntityExtractionContext, env: Cloudflare.Env): Promise<EntityExtractionResult>
/**
Extract entities from a full report (headline + body) with caching
*/
  extractFromReport(headline: string, body: string, reportId: string, channelId: string, env: Cloudflare.Env): Promise<EntityExtractionResult>
/**
Get cached entities for a report, if available
*/
  getCachedEntities(reportId: string, env: Cloudflare.Env): Promise<EntityExtractionResult | null>
/**
Get entities for multiple reports efficiently
*/
  getEntitiesForReports(reportIds: string[], env: Cloudflare.Env): Promise<Record<string, EntityExtractionResult>>
/**
Filter entities by type and minimum relevance score
*/
  filterEntities(entities: ExtractedEntity[], types?: Array<ExtractedEntity['type']>, minRelevance = 0.3): ExtractedEntity[]
/**
Get top entities by type
*/
  getTopEntitiesByType(entities: ExtractedEntity[], maxPerType = 5): Record<string, ExtractedEntity[]>
```

## src/lib/utils/entity-relevance-scorer.ts

```typescript
export interface Entity {  type: 'person' | 'company' | 'fund';  name: string;  country?: string;  netWorth?: number;  marketCap?: number;  aum?: number;
}
export interface Relationship {  from: string;  to: string;  type: string;  strength?: number;
}
export interface EntityRelevanceScore {  entityId: string;  score: number;  detailLevel: 1 | 2 | 3 | 4 | 5;  reasons: string[];  financialValue: number;
}
export class EntityRelevanceScorer
  scoreEntity(entityId: string): EntityRelevanceScore
  scoreAllEntities(): Map<string, EntityRelevanceScore>
  getTopEntities(count: number = 20): EntityRelevanceScore[]
  getTopEntitiesByScore(count: number = 20): EntityRelevanceScore[]
export function getEntityDetailLevel(entityId: string, entities: Record<string, Entity>, relationships: Relationship[]): EntityRelevanceScore
```

## src/lib/utils/fact-check-service.ts

```typescript
Imports: @/lib/cache-utils, @/lib/config, @/lib/types/core, ../../../worker-configuration, ../ai-config
export class PerplexityFactCheckService
/**
Fact-check a news report using Perplexity's real-time search capabilities
*/
  factCheckReport(report: Report): Promise<FactCheckResult>
/**
Batch fact-check multiple reports
*/
  factCheckReports(reports: Report[]): Promise<FactCheckResult[]>
```

## src/lib/utils/image-service.ts

```typescript
Imports: ../../../worker-configuration
export class ImageService
  generateImage(headline: string): Promise<ArrayBuffer>
```

## src/lib/utils/message-filter-service.ts

```typescript
Imports: @/lib/config, @/lib/types/core
/**
Centralized message filtering service
Provides various filters for processing Discord messages
*/
export class MessageFilterService
/**
Filter messages by bot username and discriminator
*/
  byBot(messages: DiscordMessage[]): DiscordMessage[]
/**
Filter messages by timestamp (after a given date)
*/
  byTimeAfter(messages: DiscordMessage[], since: Date): DiscordMessage[]
/**
Filter messages by timestamp (before a given date)
*/
  byTimeBefore(messages: DiscordMessage[], until: Date): DiscordMessage[]
/**
Filter messages by time range
*/
  byTimeRange(messages: DiscordMessage[], start: Date, end: Date): DiscordMessage[]
/**
Filter messages by specific message IDs
*/
  byIds(messages: DiscordMessage[], ids: string[]): DiscordMessage[]
/**
Remove duplicate messages based on content
*/
  uniqueByContent(messages: DiscordMessage[]): DiscordMessage[]
/**
Filter messages by content keywords
*/
  byKeywords(messages: DiscordMessage[], keywords: string[], matchAll = false): DiscordMessage[]
/**
Filter messages by author
*/
  byAuthor(messages: DiscordMessage[], authorUsername: string): DiscordMessage[]
/**
Filter messages that have embeds
*/
  withEmbeds(messages: DiscordMessage[]): DiscordMessage[]
/**
Filter messages that have attachments
*/
  withAttachments(messages: DiscordMessage[]): DiscordMessage[]
/**
Filter messages by length (useful for filtering out very short or very long messages)
*/
  byContentLength(messages: DiscordMessage[], minLength = 0, maxLength = Infinity): DiscordMessage[]
/**
Filter messages that are replies to other messages
*/
  repliesOnly(messages: DiscordMessage[]): DiscordMessage[]
/**
Filter messages that are not replies (original messages)
*/
  originalOnly(messages: DiscordMessage[]): DiscordMessage[]
/**
Advanced filter with multiple criteria
*/
  advanced(messages: DiscordMessage[], criteria: {
        authors?: string[];
        keywords?: string[];
        keywordMatchAll?: boolean;
        hasEmbeds?: boolean;
        hasAttachments?: boolean;
        minLength?: number;
        maxLength?: number;
        startDate?: Date;
        endDate?: Date;
        repliesOnly?: boolean;
        originalOnly?: boolean;
    }): DiscordMessage[]
/**
Chain multiple filters together
*/
  chain(messages: DiscordMessage[], ...filters: Array<(msgs: DiscordMessage[]) => DiscordMessage[]>): DiscordMessage[]
```

## src/lib/utils/report-ai.ts

```typescript
Imports: @/lib/ai-config, @/lib/config, @/lib/types/core, uuid, ../../../worker-configuration, ./report-utils
export interface ReportContext {  channelId: string;  channelName: string;  messageCount: number;  timeframe: string;
}
export class ReportAI
  generate(messages: DiscordMessage[], previousReports: Report[], context: ReportContext, env: Cloudflare.Env): Promise<Report>
```

## src/lib/utils/report-cache.ts

```typescript
Imports: @/lib/config, @/lib/types/core, @/lib/utils, ../../../worker-configuration, ../cache-utils
export class ReportCache
  store(channelId: string, timeframe: TimeframeKey, reports: Report[], env: Cloudflare.Env): Promise<void>
  get(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[] | null>
  getPreviousReports(channelId: string, timeframe: TimeframeKey, env: Cloudflare.Env): Promise<Report[]>
  batchGet(keys: string[], env: Cloudflare.Env): Promise<Map<string, Report[] | null>>
  getAllReports(env: Cloudflare.Env, limit?: number): Promise<Report[]>
  getAllReportsForChannel(channelId: string, env: Cloudflare.Env, timeframe?: TimeframeKey): Promise<Report[]>
  storeHomepageReports(reports: Report[], env: Cloudflare.Env): Promise<void>
  getHomepageReports(env: Cloudflare.Env): Promise<Report[] | null>
```

## src/lib/utils/report-utils.ts

```typescript
Imports: @/lib/config, @/lib/types/core
export function formatSingleMessage(message: DiscordMessage): string
export function formatPreviousReportForContext(reports: Report[]): string
export function createPrompt(messages: DiscordMessage[], previousReports: Report[]): { prompt: string; tokenCount: number; }
export function isReportTruncated(report: { body: string }): boolean
```

## src/lib/utils/source-attribution/source-attribution-ai.ts

```typescript
Imports: @/lib/ai-config, @/lib/config, @/lib/types/core, @/lib/utils/report-utils, ../../../../worker-configuration
/**
AI service for generating source attributions for report content
*/
export class SourceAttributionAI
/**
Generate source attributions for a report
*/
  generateAttributions(report: Report, sourceMessages: DiscordMessage[], env: Cloudflare.Env): Promise<ReportSourceAttribution>
```

## src/lib/utils/source-attribution/source-attribution-service.ts

```typescript
Imports: @/lib/cache-utils, @/lib/config, @/lib/types/core, ../../../../worker-configuration, ./source-attribution-ai
/**
Service for managing source attributions with caching
*/
export class SourceAttributionService
/**
Get source attributions for a report, generating them if not cached
*/
  getAttributions(report: Report, sourceMessages: DiscordMessage[]): Promise<ReportSourceAttribution>
/**
Clear attribution cache for a specific report
*/
  clearAttributionCache(reportId: string): Promise<void>
/**
Get attribution statistics for monitoring
*/
  getAttributionStats(): Promise<{ totalAttributions: number; avgConfidence: number; coveragePercentage: number; }>
```

## src/lib/utils/twitter-utils.ts

```typescript
/**
Utility functions for Twitter-related operations
*/
/**
Counts characters in tweet text, accounting for URL shortening
Twitter counts URLs as 23 characters regardless of actual length
*/
export function countTwitterCharacters(text: string): number;
/**
Validates if text fits within Twitter's character limit
*/
export function isValidTweetLength(text: string): boolean;
/**
Extracts sentences from text for tweet content
*/
export function extractSentences(
  text: string,
  maxSentences: number = 2
): string;
/**
Truncates text to fit Twitter character limit with ellipsis
*/
export function truncateForTwitter(
  text: string,
  reservedChars: number = 0
): string;
/**
Formats a thread preview for logging/debugging
*/
export function formatThreadPreview(tweets: string[]): string;
/**
Detects X/Twitter URLs in text content
*/
export function detectTweetUrls(content: string): string[];
/**
Extracts tweet ID from X/Twitter URL
*/
export function extractTweetId(url: string): string | null;
/**
Validates if a URL is a valid X/Twitter status URL
*/
export function isValidTweetUrl(url: string): boolean;
/**
Normalizes X/Twitter URL to use x.com domain
*/
export function normalizeTweetUrl(url: string): string;
/**
Extracts the source language from a Discord embed footer text
@param footerText - The footer text (e.g., "Translated from: Arabic")
@returns The source language or null if not a translation
*/
export function extractSourceLanguage(footerText?: string): string | null;
/**
Checks if content is translated based on embed footer
@param footerText - The footer text from Discord embed
@returns boolean indicating if content is translated
*/
export function isTranslatedContent(footerText?: string): boolean;
```

## src/lib/utils.ts

```typescript
Imports: @opennextjs/cloudflare, clsx, tailwind-merge, ../../worker-configuration, ./types/core
export function cn(...inputs: ClassValue[]): string
/**
Returns the current date in YYYY-MM-DD format
Can be used for API requests that require a date parameter
*/
export function getCurrentDate(): string
/**
Returns a date from the past in YYYY-MM-DD format
@param yearsAgo Number of years to go back from current date
*/
export function getStartDate(yearsAgo: number = 5): string
/**
Detects Telegram URLs in text content
*/
export function detectTelegramUrls(content: string): string[]
/**
Extracts channel and message ID from Telegram URL
@param url - Telegram URL (e.g., "https://t.me/nayaforiraq/33511")
@returns Channel/messageId string (e.g., "nayaforiraq/33511") or null if invalid
*/
export function extractTelegramPost(url: string): string | null
/**
Formats a date string into a human-readable format
Uses UTC to ensure consistency between server and client
@param dateString Date string to format
@param options Intl.DateTimeFormatOptions to customize the format
*/
export function formatDate(dateString: string | undefined, options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC' // Force UTC to prevent hydration mismatches
  }): string
/**
Formats a date string in the user's local timezone
Should only be used on the client side to avoid hydration mismatches
@param dateString Date string to format
@param options Intl.DateTimeFormatOptions to customize the format
*/
export function formatDateLocal(dateString: string | undefined, options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }): string
/**
Parses disposition notes to extract related executive order information
@param dispositionNotes The disposition notes string from an executive order
@returns Array of related executive order information
*/
export interface RelatedEOInfo {  relationship: string;  eoNumber: string;  date?: string;
}
export function parseDispositionNotes(dispositionNotes?: string): RelatedEOInfo[]
/**
Formats a timestamp to show only the time in HH:MM format
Uses UTC to ensure consistency between server and client
@param timestamp ISO timestamp string or custom format like "Seg, 19 Mai 2025 18:58:57 -0300"
@returns Time in HH:MM format
*/
export function formatTime(timestamp: string | undefined, showDate: boolean = false): string
/**
Formats a timestamp to show time in the user's local timezone
Should only be used on the client side to avoid hydration mismatches
@param timestamp ISO timestamp string or custom format
@param showDate Whether to include date information
@returns Time in local timezone
*/
export function formatTimeLocal(timestamp: string | undefined, showDate: boolean = false): string
/**
Formats a date and time together in the user's local timezone
Should only be used on the client side to avoid hydration mismatches
@param dateString Date string to format
@param options Intl.DateTimeFormatOptions to customize the format
*/
export function formatDateTimeLocal(dateString: string | undefined, options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }): string
/**
Returns the Cloudflare environment object from the cache context
Uses async mode as recommended by Cloudflare for SSG pages
@returns Promise<Cloudflare environment object>
*/
export getCacheContext = async (): Promise<{ env: Cloudflare.Env }> => {
  // Detect build environment
  const isBuildTime = process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build';

  if (isBuildTime) {
    console.log('[BUILD] Build environment detected, returning null env');
    return { env: null as unknown as Cloudflare.Env };
  }

  return await getCloudflareContext({ async: true }) as unknown as { env: Cloudflare.Env };
}
export function convertTimestampToUnixTimestamp(timestamp: string): number
export function groupAndSortReports(reports: Report[]): Report[]
```

## src/middleware.ts

```typescript
Imports: @clerk/nextjs/server
export config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
}
```
