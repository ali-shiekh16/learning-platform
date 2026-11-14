import { z } from 'zod'

/**
 * All configuration comes from environment variables and is validated once at
 * startup. A missing or malformed value stops the server immediately with a clear
 * message, instead of failing later in some unrelated request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  // Set when running behind a reverse proxy (e.g. Render, Railway), so request.ip is
  // the visitor's address from X-Forwarded-For instead of the proxy's.
  // "true" trusts any proxy; otherwise a comma-separated list of proxy IPs/CIDRs.
  // Unset or "false": trust none, so clients cannot fake their address.
  TRUST_PROXY: z
    .string()
    .optional()
    .transform(value =>
      value === undefined || value === 'false' ? false : value === 'true' ? true : value,
    ),
})

export type Env = z.infer<typeof envSchema>

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const problems = result.error.issues
      .map(issue => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${problems}`)
  }
  return result.data
}

export const env = loadEnv()
export const isProduction = env.NODE_ENV === 'production'
