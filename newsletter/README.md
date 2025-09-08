# Newsletter Builder

Dev tool for creating Fast Takeoff News newsletters with image selection.

## Setup

1. Install dependencies:
```bash
cd newsletter/
npm install
```

2. Start the dev server:
```bash
npm start
```

3. Open in browser:
```
http://localhost:3001/newsletter-builder.html
```

## Daily Workflow

1. **Get Data**: Click "🔄 Get Newsletter Data" - runs the generation script
2. **Generate**: Click "📰 Generate Newsletter" - loads fresh stories
3. **Select Images**: Choose images for each story from Discord galleries
4. **Export**: Click "📧 Export Final Newsletter HTML" - downloads clean HTML

## Files

- `server.js` - Express server with API endpoint
- `newsletter-builder.html` - Interactive newsletter builder UI
- `package.json` - Node dependencies

The generated newsletter data is saved to `../newsletter-data.json` in the project root.