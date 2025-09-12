#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { V13ToV20Migrator } from '../src/migration/V13ToV20Migrator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SAMPLES_DIR = path.join(__dirname, '../demo/samples');
const LEGACY_DIR = path.join(SAMPLES_DIR, 'legacy');

async function migrateSample(filename: string): Promise<void> {
  const originalPath = path.join(SAMPLES_DIR, filename);
  const legacyPath = path.join(LEGACY_DIR, filename);
  
  console.log(`\n🔄 Migrating ${filename}...`);
  
  // 1. Read original v1.3 file
  const v13Content = fs.readFileSync(originalPath, 'utf-8');
  const v13Scenario = JSON.parse(v13Content);
  
  // 2. Backup to legacy folder
  fs.writeFileSync(legacyPath, v13Content);
  console.log(`   ✅ Backed up to legacy/${filename}`);
  
  // 3. Migrate to v2.0
  const migrator = new V13ToV20Migrator({
    extractDefines: true,
    defineStrategy: 'conservative', // 보수적 전략 적용
    generateNodeIds: true,
    showWarnings: true,
    preserveSemantics: true,
  });
  
  const result = migrator.migrate(v13Scenario);
  
  // 4. Write v2.0 version
  const v20Content = JSON.stringify(result.scenario, null, 2);
  fs.writeFileSync(originalPath, v20Content);
  
  // 5. Show migration stats
  console.log(`   📊 Migration stats:`);
  console.log(`      - Extracted defines: ${result.extractedDefines}`);
  console.log(`      - Generated IDs: ${result.generatedIds}`);
  console.log(`      - Warnings: ${result.warnings.length}`);
  
  if (result.warnings.length > 0) {
    console.log(`   ⚠️  Warnings:`);
    result.warnings.forEach(warning => {
      console.log(`      - ${warning}`);
    });
  }
  
  console.log(`   ✅ Migrated to v2.0`);
}

async function migrateAllSamples(): Promise<void> {
  console.log('🚀 Starting v1.3 → v2.0 migration for all sample files...\n');
  
  // Ensure legacy directory exists
  if (!fs.existsSync(LEGACY_DIR)) {
    fs.mkdirSync(LEGACY_DIR, { recursive: true });
    console.log('📁 Created legacy backup directory');
  }
  
  // Get all JSON files in samples directory
  const files = fs.readdirSync(SAMPLES_DIR)
    .filter(file => file.endsWith('.json') && !file.startsWith('.'));
  
  console.log(`📄 Found ${files.length} sample files to migrate:`);
  files.forEach(file => console.log(`   - ${file}`));
  
  // Migrate each file
  for (const file of files) {
    try {
      await migrateSample(file);
    } catch (error) {
      console.error(`❌ Failed to migrate ${file}:`, error);
    }
  }
  
  console.log(`\n🎉 Migration complete! All ${files.length} files processed.`);
  console.log('   Original v1.3 files backed up to demo/samples/legacy/');
  console.log('   Updated v2.0 files saved to demo/samples/');
}

// Run migration when script is executed directly
migrateAllSamples().catch(console.error);

export { migrateSample, migrateAllSamples };