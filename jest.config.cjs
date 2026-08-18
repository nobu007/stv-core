/** Mirrors the parent repo's ESM jest setup (ts-jest default-esm preset). */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testTimeout: 30000,
  maxWorkers: 2,
  setupFiles: ['<rootDir>/tests/setupJestGlobals.ts'],
  testMatch: ['**/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  extensionsToTreatAsEsm: ['.ts'],
};
