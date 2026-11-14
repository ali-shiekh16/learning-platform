import { execSync } from 'node:child_process'

/**
 * Bring the test database up to date by applying every migration.
 *
 * Deliberately `migrate deploy` (non-destructive) rather than `migrate reset`: tests
 * never depend on an empty database — every test creates its own users with unique
 * emails — so there is no need to wipe anything between runs.
 */
export default function setup() {
  const databaseUrl =
    process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5433/learning_test'

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  })
}
