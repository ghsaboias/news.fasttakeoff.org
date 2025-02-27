# AI World News

A lightweight Next.js application that displays real-time financial and market news from the MKT News API via WebSocket connection.

## Features

- Real-time news updates via WebSocket
- Responsive design for all device sizes
- Static site generation for fast loading
- Lightweight and minimal dependencies

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- Shadcn UI Components
- React Use WebSocket

## Development

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Deployment

The application is automatically deployed to the server when changes are pushed to the master branch using GitHub Actions.

### Manual Deployment

1. Build the application:

```bash
npm run build
```

2. The static files will be generated in the `out` directory
3. Deploy the contents of the `out` directory to your web server

## Project Structure

- `src/app/contexts/WebSocketContext.tsx` - WebSocket connection and data management
- `src/components/NewsCard.tsx` - Component for displaying individual news items
- `src/components/NewsFeed.tsx` - Component for displaying the list of news items
- `src/app/page.tsx` - Main page layout
- `src/app/layout.tsx` - Root layout with WebSocket provider

## Data Source

The application connects to the MKT News API via WebSocket at `wss://api.mktnews.net`.
