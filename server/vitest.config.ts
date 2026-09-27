import { defineConfig } from 'vitest/config';

// Tests run against a separate SQLite file so they never touch dev data.
const testEnv = {
  DATABASE_URL: 'file:./test.db',
  JWT_SECRET: 'test-secret',
  NODE_ENV: 'test',
};

export default defineConfig({
  test: {
    env: testEnv,
    globalSetup: ['./tests/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
