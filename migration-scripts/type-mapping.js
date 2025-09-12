#!/usr/bin/env node
/**
 * Type Migration Mapping Script
 * Creates mapping between types and their new domain files
 */

// Complete mapping of all types to their domain files
const TYPE_TO_DOMAIN = {
  // Discord types
  'DiscordMessage': '@/lib/types/discord',
  'PermissionOverwrite': '@/lib/types/discord',
  'DiscordChannel': '@/lib/types/discord', 
  'DiscordMessagesResponse': '@/lib/types/discord',

  // Report types
  'Report': '@/lib/types/reports',
  'CachedMessages': '@/lib/types/reports',
  'ReportResponse': '@/lib/types/reports',
  'EnhancedReport': '@/lib/types/reports',
  'SourceAttribution': '@/lib/types/reports',
  'ReportSourceAttribution': '@/lib/types/reports',
  'FactCheckClaim': '@/lib/types/reports',
  'FactCheckResult': '@/lib/types/reports',
  'ExecutiveSummary': '@/lib/types/reports',
  'ChannelMessageCounts': '@/lib/types/reports',

  // Entity types
  'EntityMention': '@/lib/types/entities',
  'Entity': '@/lib/types/entities',
  'ExtractedEntity': '@/lib/types/entities',
  'EntityExtractionResult': '@/lib/types/entities',
  'GraphNode': '@/lib/types/entities',
  'GraphLink': '@/lib/types/entities',
  'GraphData': '@/lib/types/entities',
  'TransformedGraphData': '@/lib/types/entities',
  'GraphEntitiesResponse': '@/lib/types/entities',

  // Social media types  
  'TweetEmbed': '@/lib/types/social-media',
  'TweetEmbedCache': '@/lib/types/social-media',
  'FacebookPostResponse': '@/lib/types/social-media',
  'FacebookPageResponse': '@/lib/types/social-media',
  'InstagramMediaResponse': '@/lib/types/social-media',
  'InstagramPublishResponse': '@/lib/types/social-media',
  'TwitterOEmbedResponse': '@/lib/types/social-media',

  // Feed types
  'FeedAlternative': '@/lib/types/feeds',
  'FeedSeed': '@/lib/types/feeds', 
  'FeedItem': '@/lib/types/feeds',
  'SummaryInputData': '@/lib/types/feeds',
  'SelectedStory': '@/lib/types/feeds',
  'UnselectedStory': '@/lib/types/feeds',
  'SummaryMetrics': '@/lib/types/feeds',
  'SummaryResult': '@/lib/types/feeds',

  // MktNews types
  'MktNewsMessage': '@/lib/types/mktnews',
  'MktNewsRemark': '@/lib/types/mktnews',
  'CachedMktNews': '@/lib/types/mktnews',
  'MktNewsSummary': '@/lib/types/mktnews',

  // Database types
  'ReportRow': '@/lib/types/database',

  // External API types
  'OpenAIMessage': '@/lib/types/external-apis',
  'OpenAIChoice': '@/lib/types/external-apis',
  'OpenAIResponse': '@/lib/types/external-apis',
  'GeolocationResponse': '@/lib/types/external-apis',
  'TranslationResponse': '@/lib/types/external-apis',
  'PiServerStatsResponse': '@/lib/types/external-apis',
  'ApiErrorResponse': '@/lib/types/external-apis',
  'SummaryResponse': '@/lib/types/external-apis',
  'ImageResponse': '@/lib/types/external-apis',
  'OpenRouterImageMessage': '@/lib/types/external-apis',
  'OpenRouterImageChoice': '@/lib/types/external-apis',
  'OpenRouterImageResponse': '@/lib/types/external-apis',
};

// Types that should remain in core.ts (not migrated)
const CORE_TYPES = [
  'ExecutiveOrderBase',
  'Section', 
  'Content',
  'Agency',
  'Publication',
  'DocumentLinks',
  'DocumentMetadata',
  'Image',
  'ExecutiveOrder',
  'Session',
  'LinkPreview'
];

/**
 * Get domain for a type
 */
function getDomainForType(typeName) {
  return TYPE_TO_DOMAIN[typeName] || null;
}

/**
 * Check if type should remain in core
 */
function shouldRemainInCore(typeName) {
  return CORE_TYPES.includes(typeName);
}

/**
 * Group types by domain
 */
function groupTypesByDomain(types) {
  const groups = {};
  
  for (const type of types) {
    const domain = getDomainForType(type);
    if (domain) {
      if (!groups[domain]) {
        groups[domain] = [];
      }
      groups[domain].push(type);
    } else if (shouldRemainInCore(type)) {
      if (!groups['@/lib/types/core']) {
        groups['@/lib/types/core'] = [];
      }
      groups['@/lib/types/core'].push(type);
    } else {
      console.warn(`Unknown type: ${type}`);
    }
  }
  
  return groups;
}

/**
 * Extract types from import statement
 */
function extractTypesFromImport(importStatement) {
  const match = importStatement.match(/import\s*\{\s*([^}]+)\s*\}/);
  if (!match) return [];
  
  return match[1]
    .split(',')
    .map(type => type.trim().replace(/\s+as\s+\w+/, '')) // Remove 'as alias'
    .filter(type => type.length > 0);
}

/**
 * Generate new import statements for types
 */
function generateNewImports(types) {
  const groups = groupTypesByDomain(types);
  const imports = [];
  
  for (const [domain, domainTypes] of Object.entries(groups)) {
    const typesList = domainTypes.join(', ');
    imports.push(`import { ${typesList} } from '${domain}';`);
  }
  
  return imports;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node type-mapping.js <type1> [type2] ... - Map types to domains');
    console.log('  node type-mapping.js --import "import { Type1, Type2 } from \'@/lib/types/core\'" - Process import statement');
    process.exit(1);
  }
  
  if (args[0] === '--import') {
    const importStatement = args[1];
    const types = extractTypesFromImport(importStatement);
    const newImports = generateNewImports(types);
    
    console.log('Original:', importStatement);
    console.log('New imports:');
    newImports.forEach(imp => console.log('  ' + imp));
  } else {
    // Map individual types
    for (const type of args) {
      const domain = getDomainForType(type);
      if (domain) {
        console.log(`${type} → ${domain}`);
      } else if (shouldRemainInCore(type)) {
        console.log(`${type} → @/lib/types/core (stays in core)`);
      } else {
        console.log(`${type} → UNKNOWN TYPE`);
      }
    }
  }
}

module.exports = {
  TYPE_TO_DOMAIN,
  CORE_TYPES,
  getDomainForType,
  shouldRemainInCore,
  groupTypesByDomain,
  extractTypesFromImport,
  generateNewImports
};