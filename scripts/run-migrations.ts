#!/usr/bin/env node
/**
 * Run database migrations
 * This script is called during deployment to ensure migrations run before the app starts
 */

import { pool } from '../lib/pool';
import { runMigrations } from '../lib/migrations';

async function main() {
  console.log('[Migrations] Starting migration check...');

  try {
    const result = await runMigrations(pool);

    if (result.success) {
      console.log('[Migrations] ✓ Success:', result.message);
      process.exit(0);
    } else {
      console.error('[Migrations] ✗ Failed:', result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('[Migrations] ✗ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

