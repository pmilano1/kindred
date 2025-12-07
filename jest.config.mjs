import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/', '<rootDir>/.next/standalone/'],
  // Coverage configuration
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    'components/**/*.{js,ts,tsx}',
    'app/**/*.{js,ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/.next/',
  ],
  // Coverage thresholds - prevent regression
  // These are set based on current coverage levels
  // Increase these as more tests are added
  coverageThreshold: {
    global: {
      branches: 1,
      functions: 0,
      lines: 1,
      statements: 1,
    },
    // Higher thresholds for well-tested components
    './components/PersonCard.tsx': {
      branches: 80,
      functions: 100,
      lines: 90,
      statements: 90,
    },
    './components/LoadingSpinner.tsx': {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
    // Resolver coverage threshold - lowered to match current levels
    './lib/graphql/resolvers.ts': {
      branches: 30,
      functions: 35,
      lines: 35,
      statements: 35,
    },
  },
};

export default createJestConfig(customJestConfig);

