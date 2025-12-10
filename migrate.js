#!/usr/bin/env node
/**
 * Production Migration Runner
 * 
 * Industry standard approach: Run migrations as a separate step before starting the app.
 * This is the pattern used by Prisma (prisma migrate deploy) and Drizzle ORM.
 * 
 * This script:
 * 1. Connects to the database
 * 2. Runs pending migrations
 * 3. Exits with code 0 on success, 1 on failure
 * 
 * Usage:
 *   node migrate.js && node server.js
 */

const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

// Migration lock to prevent concurrent runs
const MIGRATION_LOCK_ID = 12345;

async function getCurrentVersion() {
  // Ensure schema_migrations table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT NOW()
    )
  `);
  
  const { rows } = await pool.query(
    'SELECT MAX(version) as version FROM schema_migrations'
  );
  return rows[0]?.version || 0;
}

async function runMigrations() {
  console.log('[Migrate] Starting migration process...');
  
  try {
    // Acquire advisory lock (10 second timeout)
    const lockResult = await pool.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [MIGRATION_LOCK_ID]
    );
    
    if (!lockResult.rows[0].acquired) {
      console.log('[Migrate] Another migration is in progress, waiting...');
      await pool.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    }
    
    const currentVersion = await getCurrentVersion();
    console.log(`[Migrate] Current database version: ${currentVersion}`);
    
    // Import migrations dynamically
    const { migrations } = require('./lib/migrations');
    const latestVersion = Math.max(...migrations.map(m => m.version), 0);
    
    console.log(`[Migrate] Latest migration version: ${latestVersion}`);
    
    if (currentVersion >= latestVersion) {
      console.log('[Migrate] ✓ Database is up to date');
      return true;
    }
    
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    console.log(`[Migrate] Found ${pendingMigrations.length} pending migrations`);
    
    // Run each pending migration
    for (const migration of pendingMigrations) {
      console.log(`[Migrate] Running migration ${migration.version}: ${migration.name}`);
      
      try {
        const results = await migration.up(pool);
        
        // Record migration
        await pool.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        
        console.log(`[Migrate] ✓ Migration ${migration.version} complete:`, results.join(', '));
      } catch (error) {
        console.error(`[Migrate] ✗ Migration ${migration.version} failed:`, error.message);
        throw error;
      }
    }
    
    console.log('[Migrate] ✓ All migrations complete');
    return true;
    
  } catch (error) {
    console.error('[Migrate] ✗ Migration failed:', error);
    return false;
  } finally {
    // Release advisory lock
    await pool.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
  }
}

async function main() {
  try {
    const success = await runMigrations();
    await pool.end();
    
    if (success) {
      console.log('[Migrate] Exiting with success');
      process.exit(0);
    } else {
      console.error('[Migrate] Exiting with failure');
      process.exit(1);
    }
  } catch (error) {
    console.error('[Migrate] Fatal error:', error);
    await pool.end();
    process.exit(1);
  }
}

main();

