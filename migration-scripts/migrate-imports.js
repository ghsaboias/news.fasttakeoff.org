#!/usr/bin/env node
/**
 * Import Migration Script
 * Automatically migrates imports from @/lib/types/core to domain-specific files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { 
  extractTypesFromImport, 
  generateNewImports, 
  getDomainForType,
  shouldRemainInCore 
} = require('./type-mapping');

/**
 * Find all files importing from @/lib/types/core
 */
function findFilesWithCoreImports() {
  try {
    const output = execSync(`grep -r "import.*from ['\"]\@/lib/types/core['\"]" src --include="*.ts" --include="*.tsx" -l`, 
      { encoding: 'utf-8' });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}

/**
 * Analyze import complexity of a file
 */
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importMatch = content.match(/import\s*\{[^}]+\}\s*from\s*['"]@\/lib\/types\/core['"]/);
  
  if (!importMatch) {
    return null;
  }
  
  const types = extractTypesFromImport(importMatch[0]);
  const validTypes = types.filter(type => 
    getDomainForType(type) || shouldRemainInCore(type)
  );
  
  return {
    filePath,
    originalImport: importMatch[0],
    types: validTypes,
    typeCount: validTypes.length,
    riskLevel: validTypes.length === 1 ? 'LOW' : validTypes.length <= 3 ? 'MEDIUM' : 'HIGH'
  };
}

/**
 * Migrate imports in a single file
 */
function migrateFile(analysis, dryRun = false) {
  const { filePath, originalImport, types } = analysis;
  
  console.log(`\n📁 Processing: ${filePath}`);
  console.log(`   Types: ${types.join(', ')}`);
  
  // Generate new import statements
  const newImports = generateNewImports(types);
  
  if (newImports.length === 0) {
    console.log(`   ⚠️  No valid imports generated`);
    return false;
  }
  
  console.log(`   New imports:`);
  newImports.forEach(imp => console.log(`     ${imp}`));
  
  if (dryRun) {
    console.log(`   🔍 DRY RUN - would replace import`);
    return true;
  }
  
  // Read file content
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace the import
  const newImportBlock = newImports.join('\n');
  content = content.replace(originalImport, newImportBlock);
  
  // Write back to file
  fs.writeFileSync(filePath, content, 'utf-8');
  
  console.log(`   ✅ Migration completed`);
  return true;
}

/**
 * Verify file after migration
 */
function verifyFile(filePath) {
  try {
    // Check TypeScript compilation for this file
    execSync(`npx tsc --noEmit ${filePath}`, { stdio: 'pipe' });
    return true;
  } catch (error) {
    console.log(`   ❌ TypeScript errors in ${filePath}`);
    console.log(error.stdout?.toString() || error.stderr?.toString());
    return false;
  }
}

/**
 * Run migration in batches
 */
function migrateBatch(analyses, batchSize = 10, dryRun = false) {
  console.log(`\n🚀 Processing batch of ${analyses.length} files (batch size: ${batchSize})`);
  
  for (let i = 0; i < analyses.length; i += batchSize) {
    const batch = analyses.slice(i, i + batchSize);
    
    console.log(`\n📦 Batch ${Math.floor(i / batchSize) + 1}: Processing ${batch.length} files`);
    
    let allSuccessful = true;
    const processedFiles = [];
    
    // Process each file in the batch
    for (const analysis of batch) {
      const success = migrateFile(analysis, dryRun);
      if (success) {
        processedFiles.push(analysis.filePath);
      }
      allSuccessful = allSuccessful && success;
    }
    
    if (dryRun) {
      console.log(`   🔍 Dry run completed for batch`);
      continue;
    }
    
    // Verify batch
    if (allSuccessful && processedFiles.length > 0) {
      console.log(`\n🔍 Verifying batch...`);
      
      try {
        // Run TypeScript check on all files
        execSync(`npx tsc --noEmit`, { stdio: 'pipe' });
        console.log(`   ✅ Batch verification passed`);
      } catch (error) {
        console.log(`   ❌ Batch verification failed`);
        console.log(`   Rolling back batch...`);
        
        // Simple rollback - restore from git
        try {
          execSync(`git checkout -- ${processedFiles.join(' ')}`, { stdio: 'pipe' });
          console.log(`   🔄 Batch rolled back successfully`);
        } catch (rollbackError) {
          console.log(`   ⚠️  Rollback failed - manual intervention needed`);
        }
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Main migration function
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const riskLevel = args.find(arg => arg.startsWith('--risk='))?.split('=')[1] || 'ALL';
  const batchSize = parseInt(args.find(arg => arg.startsWith('--batch='))?.split('=')[1] || '10');
  
  console.log('🔄 Type Import Migration Tool');
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Risk level: ${riskLevel}`);
  console.log(`   Batch size: ${batchSize}`);
  
  // Find all files with core imports
  console.log('\n📋 Finding files with core imports...');
  const files = findFilesWithCoreImports();
  console.log(`   Found ${files.length} files`);
  
  if (files.length === 0) {
    console.log('✅ No files need migration');
    return;
  }
  
  // Analyze each file
  console.log('\n📊 Analyzing files...');
  const analyses = files
    .map(file => analyzeFile(file))
    .filter(analysis => analysis !== null);
  
  // Filter by risk level
  let filteredAnalyses = analyses;
  if (riskLevel !== 'ALL') {
    filteredAnalyses = analyses.filter(analysis => analysis.riskLevel === riskLevel);
    console.log(`   Filtered to ${filteredAnalyses.length} ${riskLevel} risk files`);
  }
  
  // Group by risk level for summary
  const riskGroups = {
    LOW: analyses.filter(a => a.riskLevel === 'LOW'),
    MEDIUM: analyses.filter(a => a.riskLevel === 'MEDIUM'), 
    HIGH: analyses.filter(a => a.riskLevel === 'HIGH')
  };
  
  console.log(`\n📈 Risk Analysis:`);
  console.log(`   LOW: ${riskGroups.LOW.length} files (1 type each)`);
  console.log(`   MEDIUM: ${riskGroups.MEDIUM.length} files (2-3 types each)`);
  console.log(`   HIGH: ${riskGroups.HIGH.length} files (4+ types each)`);
  
  if (filteredAnalyses.length === 0) {
    console.log(`   No files match risk level: ${riskLevel}`);
    return;
  }
  
  // Run migration
  const success = migrateBatch(filteredAnalyses, batchSize, dryRun);
  
  if (success) {
    console.log(`\n🎉 Migration completed successfully!`);
    if (!dryRun) {
      console.log('\nNext steps:');
      console.log('  1. Run full tests: bun run test');
      console.log('  2. Run build: bun run build'); 
      console.log('  3. Check for remaining core imports');
    }
  } else {
    console.log(`\n❌ Migration had errors - check output above`);
    process.exit(1);
  }
}

// CLI usage
if (require.main === module) {
  main();
}

module.exports = {
  findFilesWithCoreImports,
  analyzeFile,
  migrateFile,
  migrateBatch
};