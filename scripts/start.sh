#!/bin/sh
set -e

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

