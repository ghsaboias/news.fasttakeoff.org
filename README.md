# News AI World

A Next.js application aggregating executive orders from the Federal Register API and generating real-time reports from Discord channel messages. Written in TypeScript, it uses Tailwind CSS for styling, Radix UI for components, and deploys via Cloudflare Workers with KV caching.

## Overview

- **Purpose**: Fetch and display executive orders, monitor Discord channels for bot activity (e.g., FaytuksBot), and generate structured reports using the Groq API.
- **Deployment**: Hosted at news.aiworld.com.br via Cloudflare Workers.
- **Key Integrations**: Federal Register API, Discord API, Groq API for report generation.
- **Caching**: Partial implementation with Cloudflare KV and unstable_cache from Next.js.

## Technical Details

- **Framework**: Next.js 15.2.2 (React 19.0.0)
- **Language**: TypeScript 5.x
- **Styling**: Tailwind CSS 4.x with custom theming (src/app/globals.css), shadcn/ui components
- **UI Primitives**: Radix UI (@radix-ui/react-\*) for accordion, dialog, select, etc.
- **Deployment**: Cloudflare Workers (wrangler.toml), built with OpenNextJS (@opennextjs/cloudflare)
- **External APIs**:
  - Federal Register: https://www.federalregister.gov/api/v1
  - Discord: https://discord.com/api/v10
  - Groq: https://api.groq.com/openai/v1 (LLM for report generation)
- **Dependencies**: groq-sdk, lucide-react, class-variance-authority, full list in package.json
- **Configuration**: ESLint (eslint.config.mjs), PostCSS (postcss.config.mjs), TypeScript (tsconfig.json)

## Project Structure

```
src/
├── app/                  # Next.js pages and API routes
│   ├── api/             # API endpoints (e.g., /channels/active, /reports)
│   ├── current-events/  # Discord channel monitoring UI
│   ├── executive-orders/# Executive order display UI
│   └── globals.css      # Tailwind CSS configuration
├── components/          # Reusable React components
│   ├── current-events/  # Channel-specific UI (e.g., ChannelCard.tsx)
│   └── ui/             # shadcn/ui components (e.g., button.tsx)
├── lib/                # Utilities and data logic
│   ├── data/          # API clients (e.g., discord-channels.ts)
│   ├── transformers/  # Data transformation (e.g., executive-orders.ts)
│   └── types/        # TypeScript interfaces (e.g., core.ts)
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
  - GROQ_API_KEY: Groq API key for report generation

### Installation

```bash
git clone https://github.com/ghsaboias/news.aiworld.com.br.git
cd news.aiworld.com.br
npm install
```

Create .env.local:

```bash
DISCORD_TOKEN=<your-discord-bot-token>
DISCORD_GUILD_ID=<your-guild-id>
GROQ_API_KEY=<your-groq-api-key>
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

- **/api/channels/active**: Fetches Discord channels with recent bot activity, batched to avoid rate limits.
- **/api/reports**: Generates reports from Discord messages via Groq API; GET fetches cached summaries.
- **/api/channels/[channelId]/messages**: Retrieves last-hour messages for a channel.

### Frontend:

- **/current-events**: Displays active channels with message previews and report generation.
- **/executive-orders**: Lists and details executive orders with pagination and search.
- **/**: Home page with latest orders and news summaries.

### Caching:

KV partially implemented (e.g., fetchExecutiveOrderById); TODOs remain for full integration.

## Known Issues & TODOs

- Caching incomplete in /api/channels/active (see TODO: Implement caching with Cloudflare KV).
- Static generation skips some fetches (e.g., fetchExecutiveOrders during build).
- Rate limiting mitigation in DiscordClient relies on basic delays; consider a queue.

## Development Notes

- **Scripts**: See package.json for dev:worker, build:worker, etc.
- **Linting**: npm run lint with ESLint and Next.js config.
- **Type Safety**: Enforced via TypeScript; extend src/lib/types/ as needed.

## License

MIT
