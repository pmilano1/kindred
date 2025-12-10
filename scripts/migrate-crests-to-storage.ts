#!/usr/bin/env tsx
/**
 * Migration script: Convert base64 coat of arms to S3/local storage
 *
 * This script:
 * 1. Reads all surname_crests with base64 coat_of_arms data
 * 2. Decodes base64 to binary
 * 3. Uploads to storage (S3 or local based on settings)
 * 4. Updates storage_path in database
 * 5. Keeps coat_of_arms column for rollback safety
 *
 * Usage:
 *   npx tsx scripts/migrate-crests-to-storage.ts
 */

import { db } from '../lib/db';
import { uploadFile, generateFileId } from '../lib/storage';

async function migrateCrests() {
  console.log('🚀 Starting coat of arms migration to storage...\n');

  // Get all crests with base64 data but no storage_path
  const { rows: crests } = await db.query(
    `SELECT id, surname, coat_of_arms 
     FROM surname_crests 
     WHERE coat_of_arms IS NOT NULL 
       AND (storage_path IS NULL OR storage_path = '')`,
  );

  if (crests.length === 0) {
    console.log('✅ No crests to migrate. All done!');
    return;
  }

  console.log(`Found ${crests.length} crests to migrate:\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const crest of crests) {
    try {
      console.log(`Processing: ${crest.surname}...`);

      // Extract base64 data (remove data:image/png;base64, prefix if present)
      let base64Data = crest.coat_of_arms;
      if (base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
      }

      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      // Detect image type from buffer (simple magic number check)
      let ext = 'png';
      let mimeType = 'image/png';
      if (buffer[0] === 0xff && buffer[1] === 0xd8) {
        ext = 'jpg';
        mimeType = 'image/jpeg';
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
        ext = 'gif';
        mimeType = 'image/gif';
      } else if (
        buffer[0] === 0x3c &&
        buffer[1] === 0x73 &&
        buffer[2] === 0x76 &&
        buffer[3] === 0x67
      ) {
        ext = 'svg';
        mimeType = 'image/svg+xml';
      }

      // Generate storage path
      const fileId = generateFileId();
      const filename = `${fileId}.${ext}`;
      const storagePath = `crests/${crest.surname.toLowerCase()}/${filename}`;

      // Upload to storage
      await uploadFile(buffer, storagePath, mimeType);

      // Update database
      await db.query(
        `UPDATE surname_crests 
         SET storage_path = $1 
         WHERE id = $2`,
        [storagePath, crest.id],
      );

      console.log(`  ✅ Migrated to: ${storagePath}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error migrating ${crest.surname}:`, error);
      errorCount++;
    }
  }

  console.log(`\n📊 Migration complete:`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);

  if (errorCount === 0) {
    console.log(
      '\n💡 Next steps:',
    );
    console.log(
      '  1. Verify all crests display correctly in the UI',
    );
    console.log(
      '  2. Run: ALTER TABLE surname_crests ALTER COLUMN coat_of_arms DROP NOT NULL;',
    );
    console.log(
      '  3. Later: ALTER TABLE surname_crests DROP COLUMN coat_of_arms;',
    );
  }
}

// Run migration
migrateCrests()
  .then(() => {
    console.log('\n✅ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

