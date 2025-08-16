## PRD: Per-Channel RSS Feeds for Current Events

### One‑liner
Expose an RSS 2.0 feed for each Discord channel so users and tools can subscribe to updates for the channels they care about.

### Goals
- Provide machine-readable, channel-scoped feeds that update automatically from cached reports.
- Reuse existing caching and data services to keep implementation small and reliable.
- Ship with sensible defaults and robust error handling.

### Non‑Goals
- No new UI pages beyond the RSS endpoint.
- No authentication, OPML, or per-user personalization.
- No new cron jobs; reuse existing report generation cadence.

## User Stories
- As a journalist, I want to subscribe (in my RSS reader) to a specific channel’s updates so I can monitor that topic without visiting the site.
- As a researcher, I want an endpoint I can scrape/ingest to automate downstream analysis by channel.
- As an editor, I want a stable feed URL I can share with my team.

## Requirements
- Endpoint: GET `/rss/[channelId]`
  - Returns RSS 2.0 XML.
  - HTTP headers: `Content-Type: application/rss+xml`, `Cache-Control: public, max-age=1800, s-maxage=1800`.
- Feed content rules:
  - Source: cached reports for the specified `channelId` from the last 24 hours.
  - Deduplicate by `reportId` and sort newest first.
  - Limit to the most recent 50 items.
- Channel metadata:
  - `<title>`: `Fast Takeoff News — ${channelName}`
  - `<link>`: base URL for the channel landing page (see Technical Design)
  - `<description>`: short channel description: "AI-generated reports for ${channelName}."
  - `<language>`: `en-us`
  - `<lastBuildDate>` and `<pubDate>`: current UTC time.
  - `<ttl>`: 120 (minutes).
  - Include `<atom:link rel="self">` for the feed URL.
- Item fields (per report):
  - `<title>`: report `headline` (wrapped in CDATA)
  - `<link>`: canonical report URL: `${BASE_URL}/current-events/${channelId}/${reportId}`
  - `<description>`: first 300 chars of `body` with ellipsis (wrapped in CDATA)
  - `<content:encoded>`: `body` rendered as simple HTML paragraphs
  - `<pubDate>`: `generatedAt` in RFC 1123 / UTC
  - `<guid isPermaLink="true">`: same as `<link>`
  - `<category>`: always `Breaking News`, plus optional city category if present
- Error cases:
  - If `channelId` does not exist or is not accessible: return `404` with plain text body.
  - If channel exists but has no reports in the last 24h: return a valid feed with zero `<item>` entries (status `200`).

## Technical Design
- Location: create `src/app/rss/[channelId]/route.ts`.
- Data access:
  - Use `ReportService.getAllReportsForChannel(channelId)` from `src/lib/data/report-service.ts`.
  - Filter to last 24 hours using `TIME.DAY_MS` from `src/lib/config.ts`.
  - Deduplicate by `reportId`; sort by `generatedAt` desc; slice to 50.
  - Get `channelName` via `ChannelsService.getChannelName(channelId)` in `ReportService` (or infer from report if present).
- URLs and constants:
  - Base site URL: `URLs.WEBSITE_URL` from `src/lib/config.ts` (currently `https://news.fasttakeoff.org`).
  - Channel page URL (for `<link>`): `${BASE_URL}/current-events/${channelId}`.
  - Report URL: `${BASE_URL}/current-events/${channelId}/${reportId}`.
- XML output:
  - Reuse the structure implemented in `src/app/rss/route.ts` (global feed) for consistency.
  - Include `xmlns:atom` and `xmlns:content` namespaces.
  - Wrap text fields in CDATA where appropriate; render body paragraphs into simple HTML for `<content:encoded>`.
- Caching:
  - Set response headers for 30-minute public caching (`max-age` and `s-maxage` 1800s).
  - Underlying report data already cached in KV; no new KV keys required.
- Logging & monitoring:
  - Log channel lookup failures with the `channelId`.
  - Log count of items emitted.

## Acceptance Criteria
- Requesting a valid channel ID returns HTTP 200 with well-formed RSS 2.0 XML and up to 50 items from the past 24h.
- Requesting a channel with no recent reports returns HTTP 200 with an empty `<channel><item>` list.
- Requesting an unknown channel returns HTTP 404 with a short error message.
- All item `<link>` values resolve to existing pages.
- Feed is usable by standard readers (e.g., Feedly, NetNewsWire).
- Response includes `Content-Type: application/rss+xml` and `Cache-Control: public, max-age=1800, s-maxage=1800`.

## Edge Cases
- Reports missing `headline` → default to `Breaking: ${channelName} Report`.
- Reports missing `city` → omit the city `<category>`.
- Duplicate `reportId`s across timeframes → ensure de-duplication.
- Malformed `generatedAt` → skip those items.

## QA Test Plan (manual)
- Happy path: valid channel with >50 items in past 24h → returns 50 items, correctly ordered.
- Empty path: valid channel with 0 items in past 24h → returns empty feed.
- Invalid channel: gibberish `channelId` → 404.
- XML validation: open feed in multiple readers; verify last build date, TTL, atom self link, and categories.

## Risks & Mitigations
- Risk: Channel ID validation may be slow if it requires Discord API. Mitigation: use cached channels via `ChannelsService.getChannels()`.
- Risk: Very large bodies could bloat XML. Mitigation: keep `<description>` short; render `<content:encoded>` with minimal HTML; readers handle large content.

## Rollout
- Deploy endpoint; verify logs for a few popular channels.
- Add a brief note to `README.md` under RSS describing the new per-channel endpoint.

## Effort Estimate
- Engineering: ~2–4 hours (reusing existing global RSS implementation and services).
- QA: ~1 hour.