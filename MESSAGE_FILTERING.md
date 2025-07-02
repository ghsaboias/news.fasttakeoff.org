# AI-Powered Message Filtering Layer

This document describes the implementation of an intelligent message filtering system that uses Gemini AI to classify Discord messages as relevant or not relevant for news intelligence gathering.

## Overview

The filtering layer processes messages in batches of 20 through Gemini during message fetching to classify each message's relevance. The system is designed to be lenient, erring on the side of inclusion rather than exclusion.

## Architecture

### Core Components

1. **MessageFilter** (`src/lib/utils/message-filter.ts`)
   - Core filtering logic with AI classification
   - Batch processing of messages (20 per batch)
   - Configurable prompts for different use cases
   - Comprehensive error handling and retry logic

2. **EnhancedMessagesService** (`src/lib/data/enhanced-messages-service.ts`)
   - Extends existing MessagesService with filtering capabilities
   - Caching layer for filter results
   - Statistics and performance metrics
   - Multi-channel batch processing

3. **API Endpoint** (`src/app/api/messages/filtered/route.ts`)
   - REST API for testing and integration
   - Supports both single channel and multi-channel filtering
   - Configurable filter modes and parameters

## Configuration

The filtering system is configured in `src/lib/config.ts` under `AI.MESSAGE_FILTERING`:

```typescript
MESSAGE_FILTERING: {
    BATCH_SIZE: 20,                    // Messages per batch
    MAX_ATTEMPTS: 2,                   // Retry attempts for failed batches
    BATCH_DELAY_MS: 500,              // Delay between batches
    ENABLED: true,                     // Enable/disable filtering
    DEFAULT_MODE: 'lenient',           // Default filter mode
    SYSTEM_PROMPT: '...',             // AI system prompt
    CACHE_TTL: 30 * 60,               // Cache TTL (30 minutes)
}
```

## Filter Modes

The system supports multiple specialized filter modes:

### 1. News (Default)
- Breaking news and current events
- Political developments
- Economic indicators
- International affairs
- Technology announcements
- Scientific breakthroughs
- Natural disasters and emergencies

### 2. Politics
- Political news and elections
- Government actions and policy
- Political figures and statements
- International relations
- Regulatory changes

### 3. Technology
- Product launches and updates
- AI/ML developments
- Cybersecurity incidents
- Tech industry news
- Scientific computing

### 4. Finance
- Market movements and trading
- Economic indicators
- Central bank decisions
- Corporate earnings
- Currency and commodity prices

## Usage

### Basic API Usage

```bash
# Single channel filtering
GET /api/messages/filtered?channelId=123&filterMode=news&limit=50

# Multi-channel filtering
POST /api/messages/filtered
{
  "channelIds": ["123", "456"],
  "filterMode": "politics",
  "enableFiltering": true,
  "limit": 100
}
```

### Programmatic Usage

```typescript
import { EnhancedMessagesService } from '@/lib/data/enhanced-messages-service';

const messagesService = new EnhancedMessagesService(env);

// Get filtered messages
const result = await messagesService.getFilteredMessages('channelId', {
    filterMode: 'news',
    enableFiltering: true,
    limit: 50,
    since: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
});

// Access results
const { messages, filterResult, metadata } = result;
console.log(`Filtered ${metadata.totalRelevant}/${metadata.totalFetched} messages`);
```

## AI Classification Process

### 1. Message Formatting
Each message is formatted with:
- Message ID and content
- Author information
- Timestamp
- Embed information (titles, descriptions, URLs)
- Attachment details

### 2. Batch Processing
- Messages are processed in batches of 20
- Each batch is sent to Gemini for classification
- Results include relevance, confidence score, and reasoning

### 3. Classification Response
```typescript
{
  "classifications": [
    {
      "messageId": "string",
      "isRelevant": boolean,
      "confidence": number, // 0.0-1.0
      "reasoning": "string"
    }
  ]
}
```

## Error Handling

The system implements multiple layers of error handling:

1. **Batch-level Fallbacks**: Failed batches default all messages to relevant
2. **Retry Logic**: Up to 2 retry attempts with exponential backoff
3. **Service-level Fallbacks**: Filter failures return unfiltered messages
4. **Missing Classifications**: Unclassified messages default to relevant

## Performance Considerations

### Caching Strategy
- Filter results are cached for 30 minutes by default
- Cache keys include channel ID, filter mode, and message count
- Reduces API calls for repeated requests

### Rate Limiting
- 500ms delay between batches
- Sequential processing to avoid overwhelming AI API
- Configurable delays for different deployment scenarios

### Monitoring
The system provides comprehensive metrics:
- Processing time per batch and total
- Relevance rates and statistics
- Filter performance across channels
- Error rates and fallback usage

## Integration Points

### Existing Services
The filtering layer integrates with:
- **MessagesService**: Core message fetching
- **CacheManager**: Result caching
- **AI Configuration**: Provider and model settings
- **Report Generation**: Can use filtered messages

### Future Enhancements
Potential improvements include:
- Machine learning model fine-tuning
- Custom prompt templates per channel
- Real-time filtering during message ingestion
- Advanced analytics and insights
- A/B testing of filter prompts

## Security and Privacy

- No message content is stored permanently
- AI API calls use configured credentials
- Filter results respect existing cache policies
- Fallback to unfiltered on any security concerns

## Testing

Test the filtering system using:

```bash
# Start development server
npm run preview:patch:test

# Test API endpoint
curl "http://localhost:8787/api/messages/filtered?channelId=YOUR_CHANNEL_ID&filterMode=news"
```

## Troubleshooting

### Common Issues

1. **AI API Key Missing**: Ensure `OPENROUTER_API_KEY` is set
2. **Filter Not Working**: Check `AI.MESSAGE_FILTERING.ENABLED` setting
3. **High API Costs**: Adjust `BATCH_SIZE` or `CACHE_TTL`
4. **Slow Performance**: Increase `BATCH_DELAY_MS` or reduce `BATCH_SIZE`

### Debug Logging

The system provides detailed logging with `[MESSAGE_FILTER]` and `[ENHANCED_MESSAGES]` prefixes for troubleshooting.

## Contributing

When extending the filtering system:
1. Add new filter modes in `getFilterPromptForUseCase()`
2. Update configuration in `config.ts`
3. Add tests for new functionality
4. Update this documentation

---

For questions or issues, please refer to the main project documentation or create an issue in the repository.