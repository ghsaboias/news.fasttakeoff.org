# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router pages and API routes.
- `src/components`: Reusable UI (shadcn/Radix-based) in PascalCase files.
- `src/lib`: Core logic — `data/` services (Discord, feeds, EOs), `utils/`, `transformers/`, `types/` (domain-organized).
- `public/`: Static assets.
- `tests/`: Vitest tests (`tests/**/*.test.ts`) with `tests/setup.ts`.
- `scripts/`: Local utilities and model/scoring tools.
- Root config: `wrangler.toml` (Cloudflare Worker + KV/R2), `eslint.config.mjs`, `vitest.config.ts`, `tailwind.config.js`.

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
- **Normal deployment**: `git push origin master` - automatic deployment happens via Cloudflare Pages
- **Manual deployment** (emergency only): `bun run deploy` - bypasses git and deploys current working directory

## Security & Configuration
- Store secrets in `.env.local`/`.dev.vars`; never commit secrets. Cloudflare bindings are in `wrangler.toml` (KV, R2, D1, crons).
- After changing env/bindings, run `npx wrangler types` to regenerate `worker-configuration.d.ts` and re-verify `bun run preview:patch` locally.


## Newsletter Generation Flow

**Data Source**: D1 database query for top story per channel from past 24 hours, ranked by message engagement

**Files**
- `newsletter/server.js` - Express server, runs script via POST `/api/generate-newsletter`, returns data
- `newsletter/index.html` - Clean UI at `localhost:3001/`, handles all newsletter controls
- `scripts/generate-newsletter-data.js` - Fetches from D1 (not KV), includes full content + truncated versions

**Flow**
1. Start server: `cd newsletter && bun start`
2. Open `localhost:3001/`
3. Click "🔄 Get Newsletter Data" → loads D1 stories (top per channel, past 24h)
4. **Remove unwanted stories** - click "✕ Remove" button on any story
5. **Adjust content length** - dropdown per story: Brief (150 chars) / Medium (300 chars) / Full content
6. **Select images** - click images to select/deselect (toggle), galleries open by default
7. Click "📧 Export Final Newsletter HTML" → clean export (removes all UI controls and empty placeholders)

**Key Features:**
- **D1 Integration**: Fresh stories from database, not cached KV data
- **Smart Selection**: One top story per channel based on engagement (message count)
- **Content Controls**: Adjustable story length without re-generation
- **Image Toggle**: Click selected images to deselect them
- **Clean Export**: Final HTML contains no UI elements or empty placeholders
- **Daily Focus**: Automatically fetches past 24 hours for daily newsletter workflow

## Screenshot Generation
For newsletter workflow: take screenshots of rendered HTML newsletter files to help analyze and review the newsletter layout and content.

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

## Known Issues
- **Homepage stale data (Sep 2025):** Added `force-dynamic` back due to Cloudflare edge cache serving 12h+ old reports. ISR revalidation failing - investigate `getCacheContext()` in edge environment for proper SEO-friendly fix.

## Data Architecture & Debugging

### Database Schema
- **Reports table columns**: `id` (INTEGER PK), `report_id` (TEXT), `headline` (not `title`), `channel_id`, `channel_name`, `generation_trigger`, `window_start_time`, `window_end_time`, `message_count`, `message_ids` (TEXT), `generated_at` (TEXT), `body`, `city`, `user_generated`, `timeframe`, `cache_status`, etc.
- **Message storage**: Messages stored in KV as `messages:{channel_id}` (not individual message IDs)
- **Local vs production**: Local KV often has stale/partial data; recent dynamic reports may not be cached locally

### Key Patterns
- **KV message keys**: `messages:{channel_id}` contains array of Discord message objects with full metadata (the number in the key IS the Discord channel ID)
- **Message IDs in reports**: Stored as JSON array in `message_ids` column, references Discord snowflake IDs
- **Channel mapping**: Use D1 to map channel IDs to names, then fetch messages from KV by channel ID

### Dynamic Report Debugging
- Check channel metrics: `npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT channel_id, MAX(channel_name) as channel_name, AVG(message_count) as avg_msgs, COUNT(*) as reports FROM reports WHERE generated_at >= datetime('now', '-7 days') GROUP BY channel_id ORDER BY avg_msgs DESC"`
- View evaluation metrics in `REPORTS_CACHE` under keys like `window_eval_metrics:2025-09-08`
- Monitor overlap prevention via console logs: `[WINDOW_EVAL] Skipping report for channelId: X% overlap with recent report`
- Dynamic reports have `generation_trigger = 'dynamic'` in database vs `'scheduled'` for fixed intervals
### Production KV Namespaces
- **MESSAGES_CACHE**: `b3ca706f58e44201a1f3d362c358cd1c` 
- **REPORTS_CACHE**: `1907c22aa1e24a0e98f995ffcbb7b9aa`

**Common Commands:**
- List message channels: `npx wrangler kv key list --namespace-id b3ca706f58e44201a1f3d362c358cd1c --remote`
- List reports: `npx wrangler kv key list --namespace-id 1907c22aa1e24a0e98f995ffcbb7b9aa --remote`
- Get messages for channel: `npx wrangler kv key get "messages:CHANNEL_ID" --namespace-id b3ca706f58e44201a1f3d362c358cd1c --remote`

### Messages Migration Status (Active)
Currently migrating Discord messages storage from KV to D1 hybrid architecture. Migration analysis and tools located in `messages_d1_migration/` (gitignored). Phase 1 complete - see migration docs for progress and implementation details.

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

# Generate test report (replace timestamps with current window)
curl -X POST "http://localhost:8787/api/reports" -H "Content-Type: application/json" -d '{"channelId":"1312302264203087963","mode":"dynamic","windowStart":"2025-09-08T19:11:43.612Z","windowEnd":"2025-09-08T21:11:43.612Z"}'

# Generate window timestamps dynamically:
node -e "const now = new Date(); const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000); console.log(JSON.stringify({windowStart: twoHoursAgo.toISOString(), windowEnd: now.toISOString()}))"

# Check previous context
npx wrangler d1 execute FAST_TAKEOFF_NEWS_DB --remote --command "SELECT report_id, headline, channel_name, generated_at FROM reports WHERE channel_id = 'X' ORDER BY generated_at DESC LIMIT 3"
```

**Key Files**: `src/lib/config.ts` (PROMPT_TEMPLATE), `src/lib/utils/report-ai.ts` (createWindowAwarePrompt)
