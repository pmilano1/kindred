import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Use happy-dom instead of jsdom - 2-3x faster
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./vitest.setup.tsx'],
    include: ['__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next'],

    // Performance optimizations (per Vitest docs)
    pool: 'threads', // Faster than forks for larger projects
    fileParallelism: true, // Run test files in parallel



    // Dependency optimization - pre-bundle heavy deps
    deps: {
      optimizer: {
        web: {
          include: ['@apollo/client', 'next', 'next-auth', 'react', 'react-dom'],
        },
      },
    },

    // Coverage
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx', 'app/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', 'node_modules/**', '.next/**'],
    },
  },
})

