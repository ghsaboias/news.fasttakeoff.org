# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router pages and API routes.
- `src/components`: Reusable UI (shadcn/Radix-based) in PascalCase files.
- `src/lib`: Core logic — `data/` services (Discord, feeds, EOs), `utils/`, `transformers/`, `types/` (domain-organized).
- `public/`: Static assets.
- `tests/`: Vitest tests (`tests/**/*.test.ts`) with `tests/setup.ts`.
- `scripts/`: Local utilities and model/scoring tools.
- `migrations/`: D1 database migrations (numbered SQL files, e.g., `0010_create_mktnews_tables.sql`).
- Root config: `wrangler.toml` (Cloudflare Worker + KV/R2/D1), `eslint.config.mjs`, `vitest.config.ts`, `tailwind.config.js`.

## Build, Test, and Development
- `bun run dev`: Next dev server at `localhost:3000`.
- `bun run build`: Next production build.
- `bun run preview:patch:test`: Build OpenNext worker, patch scheduled handler, run `wrangler dev --test-scheduled` (use this for local testing).
- `bun run deploy`: Build, patch worker, deploy to Cloudflare.
- `bun run lint`: ESLint (Next + TypeScript rules).
- `bun run test` / `bun run test:unit`: Run all/unit tests; `bun run test:watch` to watch.
- `bun run cf-typegen`: Generate Cloudflare env typings after binding/env changes.

## TypeScript Type Organization

The codebase uses **domain-organized types** for better maintainability and clear boundaries:

```
src/lib/types/
├── core.ts              # Session, LinkPreview (truly shared only)
├── discord.ts            # DiscordMessage, DiscordChannel, etc.
├── reports.ts            # Report, ReportResponse, ReportRow, etc.
├── entities.ts           # ExtractedEntity, GraphNode, etc.
├── social-media.ts       # TweetEmbed, FacebookPostResponse, etc.
├── feeds.ts              # FeedItem, SummaryResult, etc.
├── mktnews.ts            # MktNewsMessage, CachedMktNews, etc.
├── database.ts           # Database schema types
├── external-apis.ts      # OpenAI, geolocation, etc.
├── executive-orders.ts   # Executive Orders domain types
└── api.ts               # Federal Register API types
```

**Import Guidelines:**
- Use domain-specific imports: `import { DiscordMessage } from '@/lib/types/discord'`
- Avoid importing from `@/lib/types/core` unless using Session or LinkPreview
- Group imports by domain when possible for clarity

## Dynamic Report Generation System

The application uses **activity-driven report generation** instead of fixed 2h/6h intervals:

### Channel Classification
Based on 7-day rolling averages from D1 database (`window-evaluation-service.ts`):
- **High Activity** (≥8 msgs/report): Generate when ≥3 messages OR after 30min max
- **Medium Activity** (3-7 msgs/report): Generate when ≥2 messages OR after 60min max  
- **Low Activity** (<3 msgs/report): Generate when ≥1 message OR after 180min max

### Evaluation Process
- Runs every 15 minutes via cron (`*/15 * * * *` in `wrangler.toml`)
- `WindowEvaluationService.evaluateAllChannels()` checks all active channels
- Processes channels in batches of 3 to avoid system overload
- Uses `ReportService.createDynamicReport()` when `FEATURE_FLAGS.DYNAMIC_REPORTS_ENABLED`

### Overlap Prevention
- Checks last 4 hours for existing reports to avoid duplication
- Calculates overlap percentage between new window and recent reports
- Skips generation if ≥50% overlap with recent report
- Ensures fresh content without redundant coverage

### Production Examples
Real channel behavior based on current data:
- `🟡us-politics-live` (20 avg msgs): Reports every 15-30min during active periods
- `🔴ukraine-russia-live` (12 avg msgs): Reports when activity spikes or after 30min
- `🟠myanmar` (3 avg msgs): Reports when rare updates occur or after 3hrs max

### Crisis Response
During major events (war outbreak, breaking news):
- Multiple channels trigger simultaneously within 15 minutes
- Report volume scales 2-4x automatically based on activity
- Each channel maintains independent evaluation and generation
- System naturally scales back down as activity normalizes

## Coding Style & Naming
- **Language**: TypeScript, React 19, Next.js App Router.
- **Indentation**: 2 spaces; prefer early returns and small pure functions.
- **Components**: PascalCase `.tsx` (e.g., `NewsGlobe.tsx`).
- **Hooks**: `useX` camelCase in `src/lib/hooks/`.
- **Utils/Services**: kebab-case files (e.g., `report-cache.ts`).
- **Imports**: Use `@/` alias for `src`.
- **Linting**: Fix issues or disable rules narrowly with justification. Use `cn` from `src/lib/utils.ts` for Tailwind class composition.

## Testing Guidelines
- **Framework**: Vitest (node env). Tests live in `tests/**/*.test.ts`.
- **Setup**: `tests/setup.ts` is auto-loaded (see `vitest.config.ts`).
- **Conventions**: Name files `*.test.ts`. Prefer unit tests for services/utils; mock network and env.
- **Examples**: Run a file `vitest run tests/unit/cache-utils.test.ts`.

## Commit & PR Guidelines
- **Commits**: Conventional prefixes used in history: `feat:`, `fix:`, `refactor:`, etc. Example: `feat: add node panel minimization`. **NEVER include Claude Code attribution in commit messages** - keep them clean and professional.
- **PRs**: Include scope/intent, linked issues, screenshots for UI, and a test plan. Ensure `bun run test` and `bun run lint` pass. Note any env/KV changes (`wrangler.toml`).
- **Git Integration**: Repository has automatic deployment on push to master. Commits trigger Cloudflare Pages builds and deployments.

## Deployment Process
- **DO NOT use `bun run deploy` manually** - this is for emergency/manual deployments only
- **Normal deployment**: `git push origin master` - automatic deployment via Cloudflare Workers Builds
- **Manual deployment** (emergency only): `bun run deploy` - bypasses git and deploys current working directory
- **Monitoring**: Check build status with workers-builds MCP or `npx wrangler deployments list`

## Security & Configuration
- Store secrets in `.env.local`/`.dev.vars`; never commit secrets. Cloudflare bindings are in `wrangler.toml` (KV, R2, D1, crons).
- After changing env/bindings, run `npx wrangler types` to regenerate `worker-configuration.d.ts` and re-verify `bun run preview:patch` locally.

## Newsletter Sending

**Email Domain**: `newsletter@news.fasttakeoff.org` (verified on Resend)
**Subscription System**: D1 table `newsletter_subscriptions` with unique `verification_token` per subscriber

**Workflow**:
1. Export active subscribers from remote D1:
   ```bash
   npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote \
     --command "SELECT email, verification_token FROM newsletter_subscriptions WHERE status = 'active'" \
     --json > newsletter/subscribers.json
   ```

2. Send newsletter with personalized unsubscribe links:
   ```bash
   cd newsletter
   RESEND_API_KEY=xxx node send-newsletter-from-json.js subscribers.json NEWSLETTER.html "Subject Line"
   ```

**How it works**:
- Script reads `subscribers.json` and HTML template
- Replaces `{{UNSUBSCRIBE_TOKEN}}` with each subscriber's unique token
- Sends via Resend API with 600ms rate limiting (Resend allows 2 req/sec)
- Each subscriber gets working one-click unsubscribe: `https://news.fasttakeoff.org/api/newsletter/unsubscribe?token=UNIQUE_TOKEN`

**Known Issues**:
- **Oct 20, 2025**: AWS outage (US-EAST-1 DNS/DynamoDB) caused intermittent SES failures globally, affecting Resend. Emails may return 200 OK but never reach Resend's servers. If sends fail silently (no POST in Resend logs), retry later when AWS stabilizes.

## Cron Job Monitoring
Current implementation uses KV (`CRON_STATUS_CACHE`) for live status monitoring via SSE dashboard at `/admin`.

**API Endpoints:**
- `/api/admin/live-metrics` - SSE stream for real-time status updates (✅ Used by dashboard)
- `/api/admin/cron-analytics` - Historical analytics and reporting (❌ Built but not consumed by UI yet)

**Future enhancements:** 
- Add analytics dashboard UI to consume the cron-analytics endpoint for historical trends
- Cloudflare Analytics Engine integration for long-term metrics and professional analytics dashboards


Quick Rules
- After major code changes, run "bun run lint" and "npx tsc --noEmit" and fix any errors/issues
- Never use the "any" type
- Never leave variables unused
- Wrangler commands never use ":", that's old syntax. npx wrangler kv:key list is now npx wrangler kv key list

## Server-Side Rendering & SEO

**Architecture**: Next.js 15 on Cloudflare Workers via OpenNext (@opennextjs/cloudflare v1.11.0)

**SSR Pattern (SEO-optimized pages)**:
```tsx
// page.tsx (Server Component)
export const dynamic = 'force-dynamic' // Required for Cloudflare bindings access

export default async function Page() {
  const { env } = await getCacheContext()
  const data = await fetchFromD1(env) // Server-side data fetch
  return <ClientComponent initialData={data} /> // Pass as props
}

// ClientComponent.tsx
'use client'
export default function ClientComponent({ initialData }) {
  // Use initialData immediately (no loading state)
  // Optional: Fetch on client-side navigation
}
```

**Current Status**:
- ✅ Homepage - passes initialReports, initialExecutiveOrders, initialExecutiveSummary
- ✅ Report Detail - passes initialReport, initialMessages, previousReportId, nextReportId
- ✅ Channel Detail - passes reports, channel
- ✅ Executive Order Detail - passes initialOrder

**Why `dynamic = 'force-dynamic'`**:
- Cloudflare bindings (KV, D1, R2) unavailable during build
- Forces SSR on every request in Worker runtime
- Still SEO-friendly (crawlers get full HTML)
- Alternative: `revalidate = 300` uses Cache API for ISR

## Data Architecture & Debugging

### Database Schema
- **Reports table columns**: `id` (INTEGER PK), `report_id` (TEXT), `headline` (not `title`), `channel_id`, `channel_name`, `generation_trigger`, `window_start_time`, `window_end_time`, `message_count`, `message_ids` (TEXT), `generated_at` (TEXT), `body`, `city`, `user_generated`, `timeframe`, `cache_status`, etc.
- **Message storage**: Messages are stored in D1 (`messages` table) keyed by `message_id` and `channel_id`
- **MktNews tables**: `mktnews_messages` (financial flash news with indefinite retention) and `mktnews_summaries` (hourly AI summaries). See MktNews System section for details.
- **Power Network tables**: `power_network_entities`, `power_network_relationships`, `power_network_financials` (live stock prices updated daily)
- **Local vs production**: Ensure local D1 has been populated (e.g., via `scripts/backfill`) before testing dynamic flows

### Key Patterns
- **D1 message queries**: `SELECT * FROM messages WHERE channel_id = ? AND timestamp BETWEEN ? AND ? ORDER BY timestamp DESC`
- **Message IDs in reports**: Stored as JSON array in `message_ids` column, references Discord snowflake IDs
- **Channel mapping**: Use D1 to map channel IDs to names, then fetch messages from D1 by channel ID

### Dynamic Report Debugging
- Check channel metrics: `npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT channel_id, MAX(channel_name) as channel_name, AVG(message_count) as avg_msgs, COUNT(*) as reports FROM reports WHERE generated_at >= datetime('now', '-7 days') GROUP BY channel_id ORDER BY avg_msgs DESC"`
- View evaluation metrics in `REPORTS_CACHE` under keys like `window_eval_metrics:2025-09-08`
- Monitor overlap prevention via console logs: `[WINDOW_EVAL] Skipping report for channelId: X% overlap with recent report`
- Dynamic reports have `generation_trigger = 'dynamic'` in database vs `'scheduled'` for fixed intervals
### Production KV Namespaces
- **REPORTS_CACHE**: `1907c22aa1e24a0e98f995ffcbb7b9aa`

**Common Commands:**
- List reports: `npx wrangler kv key list --namespace-id 1907c22aa1e24a0e98f995ffcbb7b9aa --remote`
- Inspect D1 messages: `npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT channel_id, COUNT(*) FROM messages GROUP BY channel_id ORDER BY COUNT(*) DESC"`

### Messages Migration Status
Discord messages now live entirely in D1. Legacy KV migration utilities have been removed; rely on D1 queries for debugging and audits.

### Prompt Quality Analysis Workflow
**Test/Iterate/Verify Flow for Dynamic Report Generation:**

1. **Generate test report**: `curl /api/reports` with specific channel/window
2. **Check previous context**: Query D1 for recent reports used as context  
3. **Fetch fresh messages**: `curl /api/trigger-cron` with `{"task": "MESSAGES"}`
4. **Test different window**: Generate report with non-overlapping timeframe
5. **Multi-channel validation**: Test across high/medium/low activity channels

**Key Quality Metrics:**
- **Source Utilization**: Message content → coherent narrative transformation
- **Attribution Quality**: Proper sourcing and quote integration
- **Context Integration**: Balance between new content vs previous context
- **Temporal Boundaries**: Current window vs background distinction

**Quick Commands:**
```bash
# NOTE: Environment variables (including CRON_SECRET) are stored in .dev.vars file
# Get CRON_SECRET value from .dev.vars (line 57) for Authorization header

# Trigger message fetch
curl -X POST "http://localhost:8787/api/trigger-cron" -H "Authorization: Bearer $(grep CRON_SECRET .dev.vars | cut -d'"' -f2)" -d '{"task": "MESSAGES"}'

# Generate test report with explicit window
curl -X POST "http://localhost:8787/api/reports" -H "Content-Type: application/json" \
  -d '{"channelId":"1312302264203087963","windowStart":"2025-09-08T19:11:43.612Z","windowEnd":"2025-09-08T21:11:43.612Z"}'

# Generate report with duration (e.g., 4 hours)
curl -X POST "http://localhost:8787/api/reports" -H "Content-Type: application/json" \
  -d '{"channelId":"1312302264203087963","windowDuration":4}'

# Generate window timestamps dynamically:
node -e "const now = new Date(); const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); console.log(JSON.stringify({windowStart: twoHoursAgo.toISOString(), windowEnd: now.toISOString()}))"

# Check previous context
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT report_id, headline, channel_name, generated_at FROM reports WHERE channel_id = 'X' ORDER BY generated_at DESC LIMIT 3"
```

**API Migration Note:**
- Legacy `timeframe` and `mode` params still work but are deprecated
- Use `windowDuration` (hours) or explicit `windowStart`/`windowEnd` for new code
- All reports now use dynamic windows regardless of generation method

**Key Files**: `src/lib/config.ts` (PROMPT_TEMPLATE), `src/lib/utils/report-ai.ts` (createWindowAwarePrompt)

## Power Network System

**Database Tables:**
- **power_network_entities** (267): People, companies, funds with financial data
- **power_network_relationships** (281): Network connections between entities
- **power_network_financials** (55+): Live stock prices updated daily at midnight UTC via `finance_data_queue`

**Commands:**
```bash
# Check data status
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT 'entities', COUNT(*) FROM power_network_entities UNION ALL SELECT 'relationships', COUNT(*) FROM power_network_relationships UNION ALL SELECT 'financials', COUNT(*) FROM power_network_financials"

# Trigger financial data update manually
curl -X POST "https://news.fasttakeoff.org/api/trigger-cron" -H "Authorization: Bearer manual-cron-trigger-secret-e1d5b8c7a9f0" -d '{"task": "FINANCIAL_DATA_QUEUE"}'
```

## MktNews System

**Data Storage**: MktNews flash messages and AI-generated summaries are stored in D1 for indefinite retention (migrated from KV).

**Database Tables:**
- **mktnews_messages**: Financial flash news from MktNews WebSocket stream
  - Stores: message_id, title, content, importance, timestamp, received_at, raw_data (JSON)
  - Indexed by: received_at, timestamp, important flag
  - Indefinite retention (no automatic cleanup)

- **mktnews_summaries**: Hourly AI-generated market summaries
  - Stores: summary_id, summary (Markdown), generated_at, message_count, timeframe
  - Generated every hour covering past 60 minutes
  - Uses previous 3 summaries as context for continuity

**Data Flow:**
1. **Raspberry Pi** pushes messages via WebSocket → `/api/mktnews/ingest`
2. **MktNewsService** stores in D1 (`mktnews_messages` table)
3. **Cron (hourly)** generates AI summaries from last 60min of messages
4. **MktNewsSummaryService** stores summaries in D1 (`mktnews_summaries` table)

**Key Services:**
- `src/lib/data/mktnews-service.ts` - Message ingestion and retrieval from D1
- `src/lib/data/mktnews-summary-service.ts` - Hourly summary generation using AI

**Commands:**
```bash
# Check MktNews data status
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT 'messages', COUNT(*) FROM mktnews_messages UNION ALL SELECT 'summaries', COUNT(*) FROM mktnews_summaries"

# View recent messages
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT message_id, title, important, received_at FROM mktnews_messages ORDER BY received_at DESC LIMIT 10"

# View recent summaries
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT summary_id, timeframe, message_count, generated_at FROM mktnews_summaries ORDER BY generated_at DESC LIMIT 5"

# Trigger manual summary generation
curl -X POST "http://localhost:8787/api/trigger-cron" -H "Authorization: Bearer $(grep CRON_SECRET .dev.vars | cut -d'"' -f2)" -d '{"task": "MKTNEWS_SUMMARY"}'
```

**Migration Notes:**
- Historical KV data can be backfilled using `node scripts/backfill-mktnews-to-d1.js` (optimized with batched inserts - 100 messages per batch)
- Migration script features: idempotent (INSERT OR IGNORE), resumable, ~70 seconds for 5,000+ messages
- Old KV namespaces (MKTNEWS_CACHE, MKTNEWS_SUMMARIES_CACHE) are deprecated but still exist
- Once D1 migration is verified, KV namespaces can be deleted
- Migration SQL schema: `migrations/0010_create_mktnews_tables.sql`
