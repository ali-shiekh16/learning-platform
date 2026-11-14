import { defineConfig } from 'vitest/config'

/**
 * Tests run against a separate Postgres database (`learning_test`) on the same
 * docker-compose server, so they never touch development data. The global setup
 * resets that database and applies all migrations before the run.
 */
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5433/learning_test'

export default defineConfig({
  test: {
    globalSetup: ['./test/global-setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-123',
      BETTER_AUTH_URL: 'http://localhost:3000',
    },
    // Test files share one database; run them one after another to keep data predictable.
    fileParallelism: false,
  },
})
