# Source Attribution System

## What it does

Maps report text to source messages. Shows tooltips on hover.

## Components

### 1. AI Service
`src/lib/utils/source-attribution/source-attribution-ai.ts`
- Calls AI to map text segments to sources
- Returns attribution objects with positions and confidence scores

### 2. Cache Service  
`src/lib/utils/source-attribution/source-attribution-service.ts`
- Wraps AI service with KV caching
- Handles batch operations

### 3. Message Filters
`src/lib/utils/message-filter-service.ts` 
- Filters messages by time, author, content, etc.
- Replaces existing inline filters

### 4. React Components
`src/components/source-attribution/`
- `AttributedReportViewer`: Drop-in replacement for report display
- `InteractiveReportBody`: Core interactive text component  
- `SourceTooltip`: Hover tooltip showing sources

### 5. API Endpoint
`src/app/api/source-attribution/route.ts`
- GET endpoint: `/api/source-attribution?reportId=xyz`
- Returns attribution data for a report

## Integration

Replace existing report body:
```tsx
// Old
<div>{report.body}</div>

// New  
<AttributedReportViewer 
  reportId={report.reportId}
  reportBody={report.body}
  sourceMessages={sourceMessages}
/>
```

## Background Processing

Cron jobs now generate attributions after reports:
- Hourly: Messages → Reports → Feeds → Attributions
- Uses existing KV cache infrastructure

## Configuration

No new environment variables needed. Uses existing AI provider config.

## Cache Keys

`attribution:{reportId}` - Stored in REPORTS_CACHE namespace

## Performance

- Request-level deduplication prevents duplicate AI calls
- Background generation reduces user wait time
- Graceful fallback to plain text if attribution fails

Done.
