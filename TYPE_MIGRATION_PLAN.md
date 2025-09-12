# Comprehensive Type Migration Plan

## Executive Summary

**Goal**: Remove backward compatibility from the type reorganization and fully transition to domain-specific type imports.

**Impact**: 62 files currently import from `@/lib/types/core` and need migration to domain-specific type files.

**Approach**: Systematic, incremental migration with automated commands and verification at each step.

## Current State Analysis

### Backward Compatibility Layer
`src/lib/types/core.ts` currently has re-exports from 8 domain files:
- `discord.ts` - 4 types (DiscordMessage, DiscordChannel, etc.)
- `reports.ts` - 10 types (Report, ReportResponse, etc.)  
- `entities.ts` - 9 types (ExtractedEntity, GraphNode, etc.)
- `social-media.ts` - 7 types (TweetEmbed, FacebookPostResponse, etc.)
- `feeds.ts` - 10 types (FeedItem, SummaryResult, etc.)
- `mktnews.ts` - 4 types (MktNewsMessage, CachedMktNews, etc.)
- `database.ts` - 1 type (ReportRow)
- `external-apis.ts` - 12 types (OpenAIResponse, ApiErrorResponse, etc.)

### Import Patterns Found
**Sample imports from files:**
- `src/lib/data/report-service.ts`: 4 types (DiscordMessage, EntityExtractionResult, Report, ReportRow)
- `src/app/page.tsx`: 3 types (ExecutiveOrder, ExecutiveSummary, Report) 
- `src/lib/interfaces/services.ts`: 4 types (DiscordMessage, Report, ReportRow, DiscordChannel)
- `src/components/current-events/MessageItem.tsx`: 1 type (DiscordMessage)
- `src/lib/data/feeds-service.ts`: 6 types (FeedItem, OpenAIResponse, SelectedStory, etc.)

### Risk Categorization
**62 total files** need migration, categorized by complexity:

- **LOW RISK (35+ files)**: 1 type each - simple replacements
- **MEDIUM RISK (20+ files)**: 2-3 types each - moderate changes  
- **HIGH RISK (5-7 files)**: 4+ types each - complex multi-domain imports

## Migration Strategy

### Phase 1: Foundation Setup (SAFE)
**Objective**: Create infrastructure and validate approach with lowest-risk files

**Steps:**
1. Create git branch for migration
2. Run full test suite to establish baseline
3. Create type mapping reference file
4. Test migration on 3 single-type files as proof-of-concept

**Duration**: 30 minutes
**Risk**: Very Low

### Phase 2: Low-Risk Batch Migration (INCREMENTAL)
**Objective**: Migrate all single-type imports systematically

**Approach**: 
- Process files importing only 1 type (35+ files)
- Use automated sed/awk commands for consistent replacements
- Verify after each batch of 10 files

**Steps:**
1. Generate mapping of type → domain file
2. Create automated replacement scripts
3. Process in batches of 10 files
4. Run TypeScript compilation after each batch
5. Run focused tests after each batch

**Duration**: 2 hours  
**Risk**: Low (automated, single changes)

### Phase 3: Medium-Risk Targeted Migration (CAREFUL)
**Objective**: Migrate multi-type imports with mixed domains

**Approach**:
- Process files importing 2-3 types (20+ files)
- Manual verification for cross-domain imports
- Convert to multiple import statements where needed

**Steps:**
1. Analyze each file's type usage domains
2. Create domain-specific import groups
3. Replace imports one file at a time
4. Verify TypeScript compilation
5. Run related tests for each file

**Duration**: 3 hours
**Risk**: Medium (manual verification needed)

### Phase 4: High-Risk Complex Migration (CAUTIOUS)
**Objective**: Migrate files with 4+ types and complex domain mixing

**Approach**:
- Process most complex files (5-7 files)
- Full manual review and testing
- Possible code structure improvements

**Steps:**
1. Map all types to domains for each file
2. Plan optimal import structure
3. Update imports with careful domain grouping
4. Extensive testing per file
5. Consider refactoring opportunities

**Duration**: 2 hours
**Risk**: High (complex changes, manual work)

### Phase 5: Core Cleanup & Finalization (FINAL)
**Objective**: Remove re-exports and clean up core.ts

**Steps:**
1. Remove all re-export statements from core.ts
2. Organize remaining types in core.ts logically
3. Run full test suite
4. Update type documentation
5. Remove migration infrastructure

**Duration**: 1 hour
**Risk**: Medium (breaking change potential)

## Implementation Commands

### Type to Domain Mapping
```bash
# Core types remaining in core.ts (will stay):
# ExecutiveOrder, Section, Content, etc. - executive orders domain
# Session, LinkPreview - core application types

# Mapping for replacements:
declare -A TYPE_TO_DOMAIN=(
  ["DiscordMessage"]="@/lib/types/discord"
  ["DiscordChannel"]="@/lib/types/discord"
  ["Report"]="@/lib/types/reports"  
  ["ReportResponse"]="@/lib/types/reports"
  ["ReportRow"]="@/lib/types/database"
  ["ExtractedEntity"]="@/lib/types/entities"
  ["GraphNode"]="@/lib/types/entities"
  ["FeedItem"]="@/lib/types/feeds"
  ["SummaryResult"]="@/lib/types/feeds"
  ["MktNewsMessage"]="@/lib/types/mktnews"
  ["CachedMktNews"]="@/lib/types/mktnews"
  ["OpenAIResponse"]="@/lib/types/external-apis"
  ["ApiErrorResponse"]="@/lib/types/external-apis"
  ["TweetEmbed"]="@/lib/types/social-media"
  # ... complete mapping for all types
)
```

### Automated Replacement Scripts
```bash
# Phase 2: Single-type replacements
replace_single_import() {
  local file=$1
  local type=$2  
  local domain=$3
  
  sed -i '' "s|import { $type } from '@/lib/types/core'|import { $type } from '$domain'|g" "$file"
}

# Phase 3: Multi-type replacements  
replace_multi_import() {
  local file=$1
  # Extract current import, split by domains, create multiple imports
  # Complex sed/awk script or custom Node.js script
}
```

### Verification Commands
```bash
# Type check after each batch
npx tsc --noEmit

# Run specific test categories
bun run test:unit           # Unit tests
bun run test src/lib/data   # Service layer tests  
bun run test src/components # Component tests

# Build verification
bun run build

# Lint check
bun run lint
```

## Risk Mitigation

### Backup Strategy
```bash
# Create backup branch before starting
git checkout -b backup-before-type-migration
git push origin backup-before-type-migration

# Create migration working branch
git checkout -b type-migration-remove-compatibility
```

### Rollback Procedures
```bash
# If migration fails at any point:
git checkout master
git checkout -b type-migration-rollback  
git reset --hard backup-before-type-migration

# Then restart from failed phase
```

### Error Detection
- TypeScript compilation fails → Stop immediately, fix before proceeding
- Test failures → Investigate and fix before batch completion  
- Build failures → Roll back last change, investigate
- Lint errors → Fix immediately to maintain code quality

## Verification Checklist

### After Each Phase
- [ ] TypeScript compilation successful (`npx tsc --noEmit`)
- [ ] All tests pass (`bun run test`)
- [ ] Application builds (`bun run build`)
- [ ] No lint errors (`bun run lint`)
- [ ] Sample pages load correctly (`bun run dev` + manual check)

### Final Verification
- [ ] All imports updated (no `@/lib/types/core` imports except legitimate ones)
- [ ] Re-exports removed from core.ts
- [ ] Core.ts only contains types that belong there
- [ ] Documentation updated
- [ ] Full test suite passes
- [ ] Production build successful
- [ ] No TypeScript errors in IDE

## Implementation Timeline

**Total Estimated Time**: 8.5 hours over 2-3 sessions

**Session 1 (4 hours)**:
- Phase 1: Foundation Setup (30min)
- Phase 2: Low-Risk Migration (2.5h)  
- Phase 3: Start Medium-Risk (1h)

**Session 2 (3 hours)**:
- Phase 3: Complete Medium-Risk (2h)
- Phase 4: High-Risk Migration (1h)

**Session 3 (1.5 hours)**:
- Phase 5: Core Cleanup (1h)
- Final Testing & Documentation (30min)

## Success Criteria

1. **Zero imports** from `@/lib/types/core` for reorganized types
2. **Core.ts contains only** types that logically belong there (ExecutiveOrder domain, Session, etc.)
3. **All tests pass** with no regressions
4. **Build succeeds** in development and production modes
5. **No TypeScript errors** across the codebase
6. **Import statements** are clean and domain-appropriate
7. **Code organization** is improved and more maintainable

## Post-Migration Benefits

1. **Clear Domain Boundaries**: Types are imported from their logical domains
2. **Improved Maintainability**: Easier to find and modify related types
3. **Better Developer Experience**: IntelliSense shows relevant types per domain
4. **Reduced Coupling**: Modules only import what they actually need
5. **Future-Proof**: New types go directly to appropriate domains
6. **Cleaner Architecture**: Type organization matches business logic domains

---

*This plan provides a systematic approach to fully migrate away from the backward compatibility layer while maintaining system stability throughout the process.*