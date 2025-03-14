# News AI World

A Next.js application hosted at news.aiworld.com.br that aggregates executive orders from the Federal Register API and generates real-time journalistic reports from Discord data. Built with TypeScript, Tailwind CSS, and deployed via Cloudflare Workers, it features a modular UI and caching with Cloudflare KV.

## Features

- Fetches and displays executive orders with detailed metadata
- Generates concise reports from Discord channel messages
- Responsive UI with reusable components (e.g., buttons, cards, dialogs)
- Type-safe codebase with TypeScript
- Styled with Tailwind CSS and shadcn/ui
- Caching via Cloudflare KV for performance

## Tech Stack

- **Framework**: Next.js 15.2.2, React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Deployment**: Cloudflare Workers
- **APIs**: Federal Register, Discord, Groq
- **Dependencies**: @radix-ui, lucide-react, groq-sdk

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm, yarn, pnpm, or bun
- Cloudflare account (for deployment)
- Environment variables: DISCORD_TOKEN, DISCORD_GUILD_ID, GROQ_API_KEY

### Installation

Clone the repo:

```bash
git clone https://github.com/ghsaboias/news.aiworld.com.br.git
cd news.aiworld.com.br
```

Install dependencies:

```bash
npm install
```

Set up environment variables in a .env.local file:

```text
DISCORD_TOKEN=your-discord-bot-token
DISCORD_GUILD_ID=your-guild-id
GROQ_API_KEY=your-groq-api-key
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build & Deploy

Build the app:

```bash
npm run build
```

Deploy to Cloudflare:

```bash
npm run deploy
```

## Project Structure

- `src/app/` - Next.js pages and API routes
- `src/components/` - Reusable UI components
- `src/lib/` - Utilities, types, and data transformers
- `.open-next/` - Cloudflare deployment artifacts

## Contributing

Pull requests are welcome! Please open an issue first to discuss changes.

## License

MIT
