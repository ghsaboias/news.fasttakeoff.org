# KV Cache Testing Documentation

This document provides instructions for testing the Cloudflare KV caching implementation in our news application.

## Overview

We've implemented caching of news reports using Cloudflare KV to improve page load times. The caching occurs at two levels:

1. **Individual channel reports** - Each channel's report is cached with a key pattern of `reports:channel:{channelId}`
2. **Homepage reports batch** - All reports shown on the homepage are cached with the key `homepage:reports`

## How to Test Cache Implementation

### Option 1: Using the Test UI

1. Visit `/kv-test` route on the deployed application
2. The UI provides tools to:
   - Read the current homepage cache (`homepage:reports` key)
   - Delete the homepage cache
   - Test the homepage API endpoint directly
   - Test custom key/value operations

### Option 2: Using API Endpoints Directly

#### Testing Individual Report Caching

1. **GET a report for a specific channel**

   ```
   POST /api/reports
   {
     "channelId": "1108138416660557928",
     "timeframe": "1h"
   }
   ```

   - First call should show `cacheStatus: "miss"`
   - Subsequent calls within 1 hour should show `cacheStatus: "hit"`

2. **Read cached report directly**
   ```
   GET /api/kv-test?key=reports:channel:1108138416660557928
   ```

#### Testing Homepage Reports Caching

1. **GET homepage reports**

   ```
   GET /api/reports
   ```

   - First call should fetch fresh reports
   - Subsequent calls within 1 hour should return cached reports
   - Check the value of `cacheStatus` in each report

2. **Read cached homepage reports directly**

   ```
   GET /api/kv-test?key=homepage:reports
   ```

3. **Delete cached homepage reports** (to test fresh reload)
   ```
   POST /api/kv-test
   {
     "key": "homepage:reports",
     "delete": true
   }
   ```

## Visual Cache Indicators

The homepage now includes visual indicators to show cache status:

- A badge in the "Latest News" section header shows "Cache Hit" or "Cache Miss"
- Each news card displays a "Cached" indicator if the report was fetched from cache

## Cache Expiration

All cached items expire after 1 hour. The system will automatically refresh the cache when items expire.

## Debugging

If you encounter issues with KV cache operations:

1. Check browser console for debug logs with `[KV DEBUG]` prefix
2. Use the `/kv-test` UI to manually test cache operations
3. Check Cloudflare dashboard for KV namespace metrics

## Implementation Details

- **Cache keys**: We use a prefix approach to organize cache entries (`reports:channel:*`, `homepage:reports`)
- **Expiration**: All entries have a 1-hour TTL
- **Data structure**: Each cached report includes:
  - Original report data (headline, city, body, timestamp)
  - `channelId` - identifies the source channel
  - `cacheStatus` - indicates if the report was retrieved from cache
  - `cachedAt` - timestamp when the report was cached

## Planned Improvements

1. Implement cache versioning to handle schema changes
2. Add cache warming for frequently accessed channels
3. Implement selective cache invalidation for specific channels
