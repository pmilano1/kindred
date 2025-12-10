#!/bin/sh
set -e

# ============================================================================
# Kindred Startup Script
# ============================================================================
#
# This script runs on every deployment to ensure database migrations execute
# before the Next.js server starts.
#
# WHY THIS EXISTS:
# - Next.js instrumentation hooks don't work on AWS App Runner
# - We need guaranteed migration execution on every deployment
# - Migrations must complete before server accepts requests
#
# HOW IT WORKS:
# 1. Check if instrumentation.js exists in the standalone build
# 2. Explicitly call register() from instrumentation.js
# 3. Wait for migrations to complete (or fail)
# 4. Start the Next.js server only if migrations succeeded
#
# FAILURE BEHAVIOR:
# - If migrations fail, the script exits with code 1
# - The server will NOT start if migrations fail
# - App Runner will retry the deployment
#
# See: instrumentation.ts for migration logic
# ============================================================================

echo "[Startup] Checking if instrumentation file exists..."

# Check if instrumentation.js exists in standalone build
if [ -f "./instrumentation.js" ]; then
  echo "[Startup] Found instrumentation.js, running migrations..."
  node -e "
    const { register } = require('./instrumentation.js');
    register().then(() => {
      console.log('[Startup] Migrations complete, starting server...');
      process.env.HOSTNAME = '0.0.0.0';
      require('./server.js');
    }).catch((err) => {
      console.error('[Startup] Migration failed:', err);
      process.exit(1);
    });
  "
else
  echo "[Startup] No instrumentation.js found, starting server without migrations..."
  echo "[Startup] WARNING: Database migrations may not have run!"
  node -e "process.env.HOSTNAME='0.0.0.0'; require('./server.js')"
fi

